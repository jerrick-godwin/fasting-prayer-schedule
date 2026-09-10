import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline/promises";

const input = createInterface({ input: process.stdin, output: process.stdout });
const password = await input.question("Admin password: ");
input.close();

if (password.length < 12) {
  console.error("Use a password with at least 12 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);
const value = `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;

console.log("\nFor .env.local:");
console.log(`ADMIN_PASSWORD_HASH=${value.replaceAll("$", "\\$")}`);
console.log("\nFor the Vercel environment-variable dashboard, use this value without backslashes:");
console.log(value);
