import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { neon } from "@neondatabase/serverless";

try { process.loadEnvFile(".env.local"); } catch {}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in .env.local.");
  process.exit(1);
}

const TEST_SCHEMA = "codex_local_edge_test";
const MOCK_PORT = 4103;
const TEST_PASSWORD = "local-test-password";
const bookingDisabled = process.argv.includes("--booking-disabled");
const databaseFailure = process.argv.includes("--database-failure");
const rootSql = neon(process.env.DATABASE_URL);

await rootSql.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`);
await rootSql.query(`CREATE SCHEMA ${TEST_SCHEMA}`);

for (const file of ["migrations/001_reservations.sql", "migrations/002_seed_blocked_slots.sql"]) {
  const source = await readFile(file, "utf8");
  for (const statement of source.split("-- statement-breakpoint").map((value) => value.trim()).filter(Boolean)) {
    await rootSql.query(statement.replace(/\breservations\b/g, `"${TEST_SCHEMA}".reservations`));
  }
}

const schemaCheck = await rootSql.query(`SELECT COUNT(*)::int AS blocks FROM "${TEST_SCHEMA}".reservations WHERE kind = 'block'`);
if (Number(schemaCheck[0]?.blocks) !== 4) {
  throw new Error("Isolated test database setup failed");
}

let nextEmail = 1;
let failNext = 0;
const messages = [];

const mockServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${MOCK_PORT}`);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");

  response.setHeader("Content-Type", "application/json");
  if (request.method === "GET" && url.pathname === "/__messages") {
    response.end(JSON.stringify({ messages }));
    return;
  }
  if (request.method === "POST" && url.pathname === "/__reset") {
    messages.length = 0;
    failNext = 0;
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.method === "POST" && url.pathname === "/__fail-next") {
    failNext += 1;
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.method === "POST" && url.pathname === "/emails") {
    if (failNext > 0) {
      failNext -= 1;
      response.statusCode = 429;
      response.end(JSON.stringify({ message: "Synthetic local email failure", name: "rate_limit_exceeded" }));
      return;
    }
    const id = `local_email_${nextEmail++}`;
    messages.push({ id, idempotencyKey: request.headers["idempotency-key"] ?? null, body: JSON.parse(raw || "{}") });
    response.end(JSON.stringify({ id }));
    return;
  }
  if (request.method === "POST" && /^\/emails\/[^/]+\/cancel$/.test(url.pathname)) {
    messages.push({ id: `cancel_${url.pathname.split("/")[2]}`, cancellation: true });
    response.end(JSON.stringify({ id: url.pathname.split("/")[2], object: "email" }));
    return;
  }
  response.statusCode = 404;
  response.end(JSON.stringify({ message: "Not found", name: "not_found" }));
});

await new Promise((resolve) => mockServer.listen(MOCK_PORT, "127.0.0.1", resolve));

const salt = randomBytes(16);
const adminHash = scryptSync(TEST_PASSWORD, salt, 64);
const child = spawn("npm", ["run", "dev"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SCHEMA: databaseFailure ? "codex_local_missing_schema" : TEST_SCHEMA,
    RESEND_API_KEY: "local-test-key",
    RESEND_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
    EMAIL_FROM: "United for God <bookings@unitedforgod.co.uk>",
    BOOKING_ADMIN_EMAIL: "organiser@example.test",
    ADMIN_PASSWORD_HASH: `scrypt$${salt.toString("base64url")}$${adminHash.toString("base64url")}`,
    LOCAL_TEST_ADMIN_PASSWORD: TEST_PASSWORD,
    ADMIN_SESSION_SECRET: "local-test-session-secret-32-characters-minimum",
    SITE_URL: "http://localhost:3000",
    BOOKING_ENABLED: bookingDisabled ? "false" : "true",
  },
});

console.log(`Local edge-test environment ready. Admin password: ${TEST_PASSWORD}`);
console.log(`Captured email API: http://127.0.0.1:${MOCK_PORT}/__messages`);

let stopping = false;
async function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  child.kill("SIGINT");
  await new Promise((resolve) => mockServer.close(resolve));
  await rootSql.query(`DROP SCHEMA IF EXISTS ${TEST_SCHEMA} CASCADE`).catch((error) => console.error("Test schema cleanup failed", error));
  process.exit(exitCode);
}

process.on("SIGINT", () => void stop(0));
process.on("SIGTERM", () => void stop(0));
child.on("exit", (code) => void stop(code ?? 0));
