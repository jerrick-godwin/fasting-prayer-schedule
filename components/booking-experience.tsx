"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicSlot } from "@/lib/slots";
import { BookingModal } from "./booking-modal";
import { CalendarSchedule } from "./calendar-schedule";

type BookingExperienceProps = {
  initialSlots: PublicSlot[];
};

export function BookingExperience({ initialSlots }: BookingExperienceProps) {
  const [slots, setSlots] = useState(initialSlots);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<PublicSlot | null>(null);
  const [emailDelayed, setEmailDelayed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshSlots = useCallback(async (showProgress = false) => {
    if (showProgress) setRefreshing(true);
    try {
      const response = await fetch("/api/slots", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { slots: PublicSlot[] };
      setSlots(data.slots);
    } finally {
      if (showProgress) setRefreshing(false);
    }
  }, []);

  const closeBooking = useCallback(() => setSelectedSlot(null), []);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshSlots(), 30_000);
    return () => window.clearInterval(timer);
  }, [refreshSlots]);

  function handleBooked(slotId: string, delayed: boolean) {
    const bookedSlot = slots.find((slot) => slot.id === slotId) ?? null;
    setSlots((current) =>
      current.map((slot) => (slot.id === slotId ? { ...slot, status: "booked" } : slot)),
    );
    setSelectedSlot(null);
    setConfirmedSlot(bookedSlot);
    setEmailDelayed(delayed);
    void refreshSlots();
  }

  const availableCount = slots.filter((slot) => slot.status === "available").length;

  return (
    <main className="booking-page">
      <section className="schedule">
        <div className="section-heading">
          <div>
            <h1>24 Hours at the Feet of God</h1>
            <p className="schedule__subtitle">Choose your time slot</p>
          </div>
        </div>
        <a
          className="schedule__location"
          href="https://www.google.com/maps/search/?api=1&query=Holy%20Family%20Church%20Hall%20Sutton%20SM1%201QU"
          target="_blank"
          rel="noreferrer"
        >
          <span aria-hidden="true">⌖</span>
          Holy Family Church Hall - Sutton SM1 1QU
          <span className="schedule__location-action">Open in Google Maps ↗</span>
        </a>
        <p className="schedule__intro">
          {availableCount} of 9 prayer slots are available. Select a time below and we&apos;ll send your
          confirmation and calendar invitation by email.
        </p>

        <div className="calendar-legend-row">
          <div className="availability-key" role="group" aria-label="Slot status legend">
            <span /> Available <span className="is-booked" /> Booked
          </div>
        </div>

        <CalendarSchedule slots={slots} onSelect={setSelectedSlot} />

        <button className="refresh-button" type="button" onClick={() => void refreshSlots(true)} disabled={refreshing}>
          <span aria-hidden="true">↻</span> {refreshing ? "Checking availability…" : "Refresh availability"}
        </button>
      </section>

      {selectedSlot ? (
        <BookingModal slot={selectedSlot} onClose={closeBooking} onBooked={handleBooked} />
      ) : null}

      {confirmedSlot ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmedSlot(null)}>
          <section className="booking-modal confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirmation-icon" aria-hidden="true">✓</div>
            <p className="eyebrow">Prayer slot reserved</p>
            <h2 id="confirmation-title">Thank you for standing with us.</h2>
            <p>{emailDelayed
              ? "Your slot is reserved. The confirmation email is delayed, and the organiser can resend it from the dashboard."
              : "Your confirmation and calendar invitation will arrive by email shortly."}</p>
            <div className={`modal-slot modal-slot--${confirmedSlot.tone}`}>
              <strong>{confirmedSlot.timeLabel}</strong>
              <span>{confirmedSlot.dayLabel}, {confirmedSlot.dateLabel} · UK time</span>
            </div>
            <button className="submit-button" type="button" onClick={() => setConfirmedSlot(null)}>Return to the schedule</button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
