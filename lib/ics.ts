import { getSlot } from "./slots";
import type { Reservation } from "./reservations";

const LOCATION = "Holy Family Church Hall - Sutton SM1 1QU";

function utcStamp(value: string | Date) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function createCalendarInvite(reservation: Reservation, method: "REQUEST" | "CANCEL") {
  const slot = getSlot(reservation.slot_id);
  if (!slot) throw new Error("Unknown reservation slot");
  const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
  const sequence = method === "CANCEL" ? 1 : 0;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//United for God//Prayer Booking//EN",
    `METHOD:${method}`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(reservation.booking_uid)}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(slot.start)}`,
    `DTEND:${utcStamp(slot.end)}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    "SUMMARY:24 Hours at the Feet of God — Prayer Slot",
    `DESCRIPTION:${escapeIcs(`Prayer Slot ${String(slot.number).padStart(2, "0")} for 24 Hours at the Feet of God.`)}`,
    `LOCATION:${escapeIcs(LOCATION)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
