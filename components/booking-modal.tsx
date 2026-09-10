"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PublicSlot } from "@/lib/slots";

type BookingModalProps = {
  slot: PublicSlot;
  onClose: () => void;
  onBooked: (slotId: string, emailDelayed: boolean) => void;
};

export function BookingModal({ slot, onClose, onBooked }: BookingModalProps) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    nameRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("modal-open");
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: slot.id,
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          website: form.get("website"),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London",
        }),
      });
      const result = (await response.json()) as { success?: boolean; emailDelayed?: boolean; message?: string };
      if (!response.ok) throw new Error(result.message || "Unable to complete the booking.");
      onBooked(slot.id, Boolean(result.emailDelayed));
    } catch (bookingError) {
      setError(
        bookingError instanceof Error
          ? bookingError.message
          : "Unable to complete the booking. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close booking form">
          ×
        </button>
        <p className="eyebrow">You&apos;re choosing</p>
        <h2 id="booking-title">Slot {String(slot.number).padStart(2, "0")}</h2>
        <div className={`modal-slot modal-slot--${slot.tone}`}>
          <strong>{slot.timeLabel}</strong>
          <span>{slot.dayLabel}, {slot.dateLabel} · UK time</span>
        </div>

        <form className="booking-form" onSubmit={handleSubmit}>
          <label>
            <span>Full name</span>
            <input ref={nameRef} name="name" type="text" autoComplete="name" minLength={2} maxLength={100} required />
          </label>
          <label>
            <span>Email address</span>
            <input name="email" type="email" autoComplete="email" maxLength={254} required />
          </label>
          <label>
            <span>Phone number</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+44 7700 900123"
              minLength={7}
              maxLength={25}
              required
            />
          </label>
          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" type="text" tabIndex={-1} autoComplete="off" />
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="submit-button" type="submit" disabled={submitting}>
            {submitting ? "Reserving your time…" : "Confirm slot"}
          </button>
          <p className="privacy-note">Your details remain private and are sent securely</p>
        </form>
      </section>
    </div>
  );
}
