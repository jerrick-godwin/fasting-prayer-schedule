import { randomBytes, scryptSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyAdminPassword } from "./admin-auth";

describe("admin password verification", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts only the password represented by the scrypt hash", () => {
    const salt = randomBytes(16);
    const hash = scryptSync("a strong organiser password", salt, 64);
    vi.stubEnv("ADMIN_PASSWORD_HASH", `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
    expect(verifyAdminPassword("a strong organiser password")).toBe(true);
    expect(verifyAdminPassword("wrong password")).toBe(false);
  });

  it("fails closed for malformed configuration", () => {
    vi.stubEnv("ADMIN_PASSWORD_HASH", "not-a-valid-hash");
    expect(verifyAdminPassword("anything")).toBe(false);
  });

  it("allows the local test password only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("LOCAL_TEST_ADMIN_PASSWORD", "local-only-password");
    expect(verifyAdminPassword("local-only-password")).toBe(true);

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD_HASH", "not-a-valid-hash");
    expect(verifyAdminPassword("local-only-password")).toBe(false);
  });
});
