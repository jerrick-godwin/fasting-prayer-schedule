import { createHash, randomBytes, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

try { process.loadEnvFile(".env.local"); } catch {}

const required = ["DATABASE_URL", "IMPORT_SLOT_ID", "IMPORT_NAME", "IMPORT_EMAIL", "IMPORT_PHONE"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  process.exit(1);
}
if (!/^slot-[1-9]$/.test(process.env.IMPORT_SLOT_ID)) {
  console.error("IMPORT_SLOT_ID must be slot-1 through slot-9.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const id = process.env.IMPORT_SLOT_ID === "slot-4"
  ? "9a1d7a37-532e-4c0c-9dc9-00275e294004"
  : randomUUID();

const rows = await sql`
  INSERT INTO reservations (
    id, slot_id, kind, status, attendee_name, attendee_email, attendee_phone,
    attendee_timezone, source, cancellation_token_hash, booking_uid, email_status
  ) VALUES (
    ${id}::uuid, ${process.env.IMPORT_SLOT_ID}, 'booking', 'active',
    ${process.env.IMPORT_NAME}, ${process.env.IMPORT_EMAIL.toLowerCase()}, ${process.env.IMPORT_PHONE},
    ${process.env.IMPORT_TIMEZONE || "Europe/London"}, 'legacy_import', ${tokenHash},
    ${`${id}@unitedforgod.co.uk`}, 'delayed'
  )
  ON CONFLICT DO NOTHING
  RETURNING id
`;

if (!rows.length) {
  console.log("No import performed: the slot is already active or this booking was already imported.");
} else {
  console.log(`Imported ${process.env.IMPORT_SLOT_ID}. Use Admin → Resend to issue the branded confirmation before cancelling the old provider booking.`);
}
