import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ufg_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
  return secret;
}

function signature(expiresAt: string) {
  return createHmac("sha256", sessionSecret()).update(expiresAt).digest("base64url");
}

export function verifyAdminPassword(password: string) {
  const localTestPassword = process.env.NODE_ENV !== "production"
    ? process.env.LOCAL_TEST_ADMIN_PASSWORD
    : undefined;
  if (localTestPassword) {
    const supplied = createHmac("sha256", "local-admin-test").update(password).digest();
    const expected = createHmac("sha256", "local-admin-test").update(localTestPassword).digest();
    return timingSafeEqual(supplied, expected);
  }
  const stored = process.env.ADMIN_PASSWORD_HASH;
  if (!stored) return false;
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  try {
    const expectedBuffer = Buffer.from(expected, "base64url");
    const supplied = scryptSync(password, Buffer.from(salt, "base64url"), expectedBuffer.length);
    return supplied.length === expectedBuffer.length && timingSafeEqual(supplied, expectedBuffer);
  } catch {
    return false;
  }
}

export async function createAdminSession() {
  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const value = `${expiresAt}.${signature(expiresAt)}`;
  const store = await cookies();
  store.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function isAdminAuthenticated() {
  try {
    const value = (await cookies()).get(COOKIE_NAME)?.value;
    if (!value) return false;
    const [expiresAt, suppliedSignature] = value.split(".");
    if (!expiresAt || !suppliedSignature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(signature(expiresAt));
    const supplied = Buffer.from(suppliedSignature);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}
