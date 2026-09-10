import { EVENT_TIMEZONE, getSlot, slots, toPublicSlot, type PublicSlot } from "./slots";

const CALENDLY_API = "https://api.calendly.com";
const EVENT_LOCATION = "Holy Family Church Hall - Sutton SM1 1QU";
const CALENDLY_TIMEOUT_MS = 8_000;

type CalendlyAvailableTime = {
  status?: string;
  start_time: string;
};

type CalendlyAvailabilityResponse = {
  collection?: CalendlyAvailableTime[];
};

type BookingInput = {
  slotId: string;
  name: string;
  email: string;
  phone: string;
  timezone: string;
};

type BookingResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "configuration" | "provider"; message: string };

function isCalendlyEnabled() {
  return process.env.CALENDLY_ENABLED === "true";
}

function getEventTypeUri(duration: number) {
  const byDuration: Record<number, string | undefined> = {
    120: process.env.CALENDLY_EVENT_TYPE_120,
    180: process.env.CALENDLY_EVENT_TYPE_180,
    235: process.env.CALENDLY_EVENT_TYPE_235,
  };
  return byDuration[duration];
}

function getConfiguration() {
  const token = process.env.CALENDLY_TOKEN;
  const eventTypes = [120, 180, 235].map(getEventTypeUri);
  if (!token || eventTypes.some((uri) => !uri)) return null;
  return { token };
}

async function fetchAvailableStarts(duration: number, token: string) {
  const eventType = getEventTypeUri(duration);
  if (!eventType) return new Set<string>();

  const query = new URLSearchParams({
    event_type: eventType,
    start_time: "2026-09-18T00:00:00.000Z",
    end_time: "2026-09-20T00:00:00.000Z",
  });

  const response = await fetch(`${CALENDLY_API}/event_type_available_times?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(CALENDLY_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Calendly availability request failed (${response.status})`);
  }

  const data = (await response.json()) as CalendlyAvailabilityResponse;
  return new Set(
    (data.collection ?? [])
      .filter((item) => item.status === undefined || item.status === "available")
      .map((item) => new Date(item.start_time).toISOString()),
  );
}

export async function getPublicSlots(): Promise<PublicSlot[]> {
  if (!isCalendlyEnabled()) {
    return slots.map((slot) => toPublicSlot(slot, !slot.initiallyBooked));
  }

  const config = getConfiguration();
  if (!config) {
    return slots.map((slot) => toPublicSlot(slot, false));
  }

  try {
    const [starts120, starts180, starts235] = await Promise.all([
      fetchAvailableStarts(120, config.token),
      fetchAvailableStarts(180, config.token),
      fetchAvailableStarts(235, config.token),
    ]);
    const byDuration: Record<number, Set<string>> = {
      120: starts120,
      180: starts180,
      235: starts235,
    };
    return slots.map((slot) => toPublicSlot(slot, byDuration[slot.duration].has(slot.start)));
  } catch (error) {
    console.error("Unable to refresh Calendly availability", error);
    return slots.map((slot) => toPublicSlot(slot, false));
  }
}

export async function createCalendlyBooking(input: BookingInput): Promise<BookingResult> {
  if (!isCalendlyEnabled()) {
    return {
      ok: false,
      reason: "configuration",
      message: "Online booking is not connected yet. Please contact the organiser.",
    };
  }

  const config = getConfiguration();
  const slot = getSlot(input.slotId);
  if (!config || !slot || slot.initiallyBooked) {
    return {
      ok: false,
      reason: slot ? "configuration" : "unavailable",
      message: slot
        ? "Online booking is not configured for this slot."
        : "This prayer slot is no longer available.",
    };
  }

  try {
    const availableStarts = await fetchAvailableStarts(slot.duration, config.token);
    if (!availableStarts.has(slot.start)) {
      return {
        ok: false,
        reason: "unavailable",
        message: "Someone has just booked this prayer slot. Please choose another one.",
      };
    }

    const eventType = getEventTypeUri(slot.duration);
    const response = await fetch(`${CALENDLY_API}/invitees`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventType,
        start_time: slot.start,
        invitee: {
          name: input.name,
          email: input.email,
          timezone: input.timezone || EVENT_TIMEZONE,
        },
        location: {
          kind: "physical",
          location: EVENT_LOCATION,
        },
        questions_and_answers: [
          {
            question: process.env.CALENDLY_PHONE_QUESTION || "Phone number",
            answer: input.phone,
            position: 0,
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(CALENDLY_TIMEOUT_MS),
    });

    if (response.ok) return { ok: true };
    if (response.status === 409) {
      return {
        ok: false,
        reason: "unavailable",
        message: "Someone has just booked this prayer slot. Please choose another one.",
      };
    }

    const providerError = (await response.json().catch(() => null)) as
      | { title?: string; message?: string; details?: unknown }
      | null;
    // Log only bounded identifiers, never provider messages that may echo PII.
    const safeIdentifier = (value: unknown) =>
      typeof value === "string" && /^[a-zA-Z0-9_.\[\]-]{1,120}$/.test(value)
        ? value
        : undefined;
    const details = Array.isArray(providerError?.details)
      ? providerError.details.map((detail: unknown) => {
          const entry = detail && typeof detail === "object" ? detail as Record<string, unknown> : {};
          return { code: safeIdentifier(entry.code), parameter: safeIdentifier(entry.parameter) };
        })
      : [];
    console.error("Calendly booking failed", JSON.stringify({
      status: response.status,
      details,
    }));
    return {
      ok: false,
      reason: "provider",
      message:
        response.status === 400 || response.status === 422
          ? "The booking service could not accept this reservation. Please contact the organiser if this continues."
          : "Calendly could not complete the booking. Please try again shortly.",
    };
  } catch (error) {
    console.error("Calendly booking request failed", error);
    return {
      ok: false,
      reason: "provider",
      message: "The booking service is temporarily unavailable. Please try again shortly.",
    };
  }
}
