import { describe, expect, it } from "vitest";
import { createCalendarInvite } from "./ics";
import type { Reservation } from "./reservations";

const reservation: Reservation = {
  id: "9a1d7a37-532e-4c0c-9dc9-00275e290002",
  slot_id: "slot-2",
  kind: "booking",
  status: "active",
  attendee_name: "Test Visitor",
  attendee_email: "visitor@example.com",
  attendee_phone: "+447700900123",
  attendee_timezone: "Europe/London",
  source: "website",
  cancellation_token_hash: "hash",
  booking_uid: "stable-booking@unitedforgod.co.uk",
  confirmation_email_id: null,
  organiser_email_id: null,
  reminder_email_id: null,
  email_status: "pending",
  email_attempt: 0,
  created_at: "2026-09-10T00:00:00.000Z",
  updated_at: "2026-09-10T00:00:00.000Z",
  cancelled_at: null,
  cancelled_by: null,
  pii_purged_at: null,
};

describe("calendar invitations", () => {
  it("uses the UK slot instants, stable UID, and one physical location", () => {
    const invite = createCalendarInvite(reservation, "REQUEST");
    expect(invite).toContain("DTSTART:20260918T110000Z");
    expect(invite).toContain("DTEND:20260918T130000Z");
    expect(invite).toContain("UID:stable-booking@unitedforgod.co.uk");
    expect(invite.match(/LOCATION:/g)).toHaveLength(1);
    expect(invite).toContain("METHOD:REQUEST");
  });

  it("creates a cancellation with the same UID and a higher sequence", () => {
    const cancellation = createCalendarInvite(reservation, "CANCEL");
    expect(cancellation).toContain("UID:stable-booking@unitedforgod.co.uk");
    expect(cancellation).toContain("METHOD:CANCEL");
    expect(cancellation).toContain("STATUS:CANCELLED");
    expect(cancellation).toContain("SEQUENCE:1");
  });
});
