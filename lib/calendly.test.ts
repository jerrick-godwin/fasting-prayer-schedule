import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCalendlyBooking } from "./calendly";

const input = {
  slotId: "slot-2", name: "Test User", email: "test@example.com",
  phone: "+447700900123", timezone: "Europe/London",
};

describe("Calendly booking integration", () => {
  beforeEach(() => {
    vi.stubEnv("CALENDLY_ENABLED", "true");
    vi.stubEnv("CALENDLY_TOKEN", "test-token");
    for (const duration of [120, 180, 235]) {
      vi.stubEnv(`CALENDLY_EVENT_TYPE_${duration}`, `https://api.calendly.com/event_types/test-${duration}`);
    }
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  function mockProvider(status: number, body: unknown, headers?: HeadersInit) {
    const fetch = vi.fn()
      .mockResolvedValueOnce(Response.json({ collection: [{ start_time: "2026-09-18T11:00:00Z", status: "available" }] }))
      .mockResolvedValueOnce(Response.json(body, { status, headers }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("submits the physical location and phone answer without incomplete optional tracking", async () => {
    const fetch = mockProvider(201, { resource: {} });
    expect(await createCalendlyBooking(input)).toEqual({ ok: true });
    const payload = JSON.parse(fetch.mock.calls[1][1].body);
    expect(payload).not.toHaveProperty("tracking");
    expect(payload.location).toEqual({ kind: "physical", location: "Holy Family Church Hall - Sutton SM1 1QU" });
    expect(payload.questions_and_answers).toEqual([{ question: "Phone number", answer: input.phone, position: 0 }]);
    expect(payload.invitee.email).toBe(input.email);
  });

  it.each([400, 422])("does not blame phone or claim a collision for validation error %i", async (status) => {
    mockProvider(status, { message: input.email, details: [{ code: "required", parameter: "tracking.utm_campaign", message: input.phone }] });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createCalendlyBooking(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("provider");
      expect(result.message).not.toMatch(/phone|Someone/);
    }
    const output = JSON.stringify(log.mock.calls);
    expect(output).toContain("tracking.utm_campaign");
    expect(output).not.toContain(input.email);
    expect(output).not.toContain(input.phone);
  });

  it("tells the invitee how long to wait when Calendly rate limits booking", async () => {
    mockProvider(429, {}, { "X-RateLimit-Reset": "3720" });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await createCalendlyBooking(input)).toEqual({
      ok: false,
      reason: "rate_limited",
      message: "Calendly is receiving too many booking requests. Please try again in about 2 hours.",
      retryAfter: 3720,
    });
  });
});
