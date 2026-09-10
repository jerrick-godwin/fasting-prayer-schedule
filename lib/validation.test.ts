import { describe, expect, it } from "vitest";
import { validateBookingPayload } from "./validation";

const valid = {
  slotId: "slot-2",
  name: "Jane Smith",
  email: "jane@example.com",
  phone: "+44 7700 900123",
  timezone: "Europe/London",
  website: "",
};

describe("booking validation", () => {
  it("accepts and normalises a valid booking", () => {
    const result = validateBookingPayload({ ...valid, email: " JANE@EXAMPLE.COM " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("jane@example.com");
  });

  it("rejects unknown slots", () => {
    expect(validateBookingPayload({ ...valid, slotId: "slot-10" }).success).toBe(false);
  });

  it("rejects malformed contact details", () => {
    expect(validateBookingPayload({ ...valid, email: "not-an-email" }).success).toBe(false);
    expect(validateBookingPayload({ ...valid, phone: "123" }).success).toBe(false);
  });

  it("rejects bot honeypot submissions", () => {
    expect(validateBookingPayload({ ...valid, website: "spam.example" }).success).toBe(false);
  });
});
