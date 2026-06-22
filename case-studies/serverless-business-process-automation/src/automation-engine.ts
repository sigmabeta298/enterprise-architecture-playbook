import { google } from "googleapis";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/* ----------------------------------------------------------------------
   DOMAIN MODEL
   ----------------------------------------------------------------------
   This represents a generic "account usage tracking" abstraction.

   It is intentionally not tied to education, billing, or subscriptions.
   The same model can represent:
   - SaaS usage limits
   - Coaching/session packages
   - API quota consumption
   - Membership entitlements
---------------------------------------------------------------------- */

interface Account {
  rowNumber: number;

  // Identity of the entity being tracked (customer, user, client, etc.)
  name: string;

  // Prefix used to map external events (calendar / logs / activity streams)
  eventPrefix: string;

  contactEmail: string;
  contactPhone: string;

  // Start point for usage calculation window
  lastBillingDate: string;

  // Allowed usage within a cycle (quota-based system)
  usageQuota: number;

  // Prevents duplicate notifications (idempotency guard)
  notificationSent: boolean;

  // Derived usage count from external system (calendar/events/logs)
  usageConsumed: number;
}

/* ----------------------------------------------------------------------
   INFRASTRUCTURE LAYER
   ----------------------------------------------------------------------
   This system intentionally uses managed services instead of a database:

   - Google Sheets → operational datastore (editable by non-technical users)
   - Google Calendar → event source of truth
   - SMTP → notification channel

   Design choice: favor operational simplicity over system complexity.
---------------------------------------------------------------------- */

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
});

const sheets = google.sheets({ version: "v4", auth });
const calendar = google.calendar({ version: "v3", auth });

/* ----------------------------------------------------------------------
   NOTIFICATION INFRASTRUCTURE
---------------------------------------------------------------------- */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,

  // Externalized credentials via environment variables (no secrets in code)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ----------------------------------------------------------------------
   DATA INGESTION LAYER
   ----------------------------------------------------------------------
   Google Sheets is treated as a lightweight configuration + state store.

   Trade-off:
   - Pros: editable, no admin UI required
   - Cons: weak schema enforcement, eventual consistency limitations
---------------------------------------------------------------------- */

async function getAccounts(): Promise<Account[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1!A:H",
  });

  const rows = res.data.values ?? [];

  return rows.slice(1).map((row, i) => ({
    rowNumber: i + 2,
    name: row[0] || "",
    eventPrefix: row[1] || "",
    contactEmail: row[2] || "",
    contactPhone: row[3] || "",
    lastBillingDate: row[4] || "",
    usageQuota: Number(row[5] || 0),
    notificationSent: String(row[6]).toUpperCase().trim() === "TRUE",
    usageConsumed: Number(row[7] || 0),
  }));
}

/* ----------------------------------------------------------------------
   EVENT RETRIEVAL LAYER
   ----------------------------------------------------------------------
   Calendar is used as a behavioral event source.

   Key constraint:
   Only events within a bounded time window are considered.
   This avoids future-dated or recurring events corrupting usage logic.
---------------------------------------------------------------------- */

async function getEventsForAccount(lastBillingDateISO: string) {
  let events: any[] = [];
  let pageToken: string | undefined;

  const nowISO = new Date().toISOString();

  do {
    const res: any = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
      timeMin: lastBillingDateISO,
      timeMax: nowISO,
    });

    events = events.concat(res.data.items ?? []);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return events;
}

/* ----------------------------------------------------------------------
   BUSINESS RULE ENGINE (lightweight)
   ----------------------------------------------------------------------
   This is where domain logic lives.

   Rule:
   - Match events by prefix
   - Count usage
   - Compare against quota
---------------------------------------------------------------------- */

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const cleanStr = dateStr.trim();
  const parts = cleanStr.split("-");

  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].toLowerCase();
    let year = parseInt(parts[2], 10);

    if (year < 100) year += 2000;

    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    const month = months[monthStr.substring(0, 3)];
    if (!isNaN(day) && month !== undefined && !isNaN(year)) {
      return new Date(year, month, day, 0, 0, 0, 0);
    }
  }

  const fallback = new Date(cleanStr);
  if (!isNaN(fallback.getTime())) {
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }

  return null;
}

/* ----------------------------------------------------------------------
   ORCHESTRATION ENGINE
   ----------------------------------------------------------------------
   This is a deterministic batch processor:

   Flow:
   1. Load accounts
   2. Derive usage from external system (calendar)
   3. Evaluate business rules
   4. Persist state
   5. Trigger notifications (if required)

   Important property:
   Idempotent execution via notificationSent flag.
---------------------------------------------------------------------- */

async function run() {
  console.log("Automation started...");

  const accounts = await getAccounts();
  console.log(`Loaded ${accounts.length} accounts.`);

  for (const a of accounts) {
    if (!a.name || !a.eventPrefix) continue;

    const cutoff = parseDate(a.lastBillingDate);
    if (!cutoff) continue;

    const events = await getEventsForAccount(cutoff.toISOString());

    const prefix = a.eventPrefix.trim().toLowerCase();

    const matches = events.filter((event) => {
      const title = (event.summary || "").trim().toLowerCase();

      return (
        title === prefix ||
        title.startsWith(prefix + ":") ||
        title.startsWith(prefix + " -")
      );
    });

    const usage = matches.length;

    const quotaReached = usage >= a.usageQuota;
    const notNotified = !a.notificationSent;

    await updateUsage(a.rowNumber, usage);

    if (quotaReached && notNotified && a.contactEmail) {
      await sendNotification(a.contactEmail, a.name, usage, a.usageQuota);
      await updateNotificationStatus(a.rowNumber, "TRUE");
    }
  }

  console.log("Automation completed.");
}

/* ----------------------------------------------------------------------
   PERSISTENCE LAYER (WRITEBACKS)
---------------------------------------------------------------------- */

async function updateUsage(row: number, value: number) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Sheet1!H${row}`,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] },
  });
}

async function updateNotificationStatus(row: number, status: "TRUE" | "FALSE") {
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Sheet1!G${row}`,
    valueInputOption: "RAW",
    requestBody: { values: [[status]] },
  });
}

/* ----------------------------------------------------------------------
   NOTIFICATION LAYER
---------------------------------------------------------------------- */

async function sendNotification(
  to: string,
  name: string,
  used: number,
  quota: number
) {
  return transporter.sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: `Usage Update for ${name}`,
    text: `Hi ${name},

This is an automated usage update.

You have consumed ${used} out of ${quota} allowed units.

If you require continuation, please take the necessary action.

Regards,
Automation System`,
  });
}

/* ----------------------------------------------------------------------
   ENTRYPOINT
---------------------------------------------------------------------- */

(async () => {
  try {
    await run();
  } catch (err) {
    console.error("Fatal error:", err);
    process.exit(1);
  }
})();
