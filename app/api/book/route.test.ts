import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendBookingEmails, createReservation, updateEmailResult } = vi.hoisted(() => ({
  sendBookingEmails: vi.fn(),
  createReservation: vi.fn(),
  updateEmailResult: vi.fn(),
}));

vi.mock("@/lib/email", () => ({ sendBookingEmails }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true, retryAfter: 0 }),
}));
vi.mock("@/lib/reservations", () => ({ createReservation, updateEmailResult }));
vi.mock("@/lib/validation", () => ({
  validateBookingPayload: (value: unknown) => ({ success: true, data: value }),
}));

import { POST } from "./route";

describe("POST /api/book", () => {
  afterEach(() => vi.unstubAllEnvs());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BOOKING_ENABLED", "true");
    createReservation.mockResolvedValue({
      ok: true,
      cancellationToken: "test-token",
      reservation: { id: "9a1d7a37-532e-4c0c-9dc9-00275e290002" },
    });
  });

  it("reports partial email delivery as delayed without losing the reservation", async () => {
    sendBookingEmails.mockResolvedValue({
      confirmationEmailId: "confirmation-id",
      organiserEmailId: null,
      reminderEmailId: "reminder-id",
      hadDeliveryDelay: true,
    });

    const response = await POST(new Request("http://localhost/api/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slotId: "slot-2",
        name: "Test Visitor",
        email: "visitor@example.test",
        phone: "+44 7700 900123",
        timezone: "Europe/London",
        website: "",
      }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ success: true, emailDelayed: true });
    expect(updateEmailResult).toHaveBeenCalledWith(
      "9a1d7a37-532e-4c0c-9dc9-00275e290002",
      expect.objectContaining({ emailStatus: "delayed" }),
    );
  });
});
