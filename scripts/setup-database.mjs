import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";

try { process.loadEnvFile(".env.local"); } catch {}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Add it to .env.local or run this with Vercel environment variables.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const files = ["migrations/001_reservations.sql", "migrations/002_seed_blocked_slots.sql"];

for (const file of files) {
  const source = await readFile(file, "utf8");
  const statements = source.split("-- statement-breakpoint").map((value) => value.trim()).filter(Boolean);
  for (const statement of statements) await sql.query(statement);
  console.log(`Applied ${file}`);
}
