import { Resend } from "resend";
import { createCalendarInvite } from "./ics";
import type { Reservation } from "./reservations";
import { getSlot } from "./slots";

const LOCATION = "Holy Family Church Hall - Sutton SM1 1QU";

let resendClient: Resend | null = null;

function getResend() {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  const baseUrl = process.env.NODE_ENV === "production" ? undefined : process.env.RESEND_BASE_URL;
  resendClient = new Resend(apiKey, baseUrl ? { baseUrl } : undefined);
  return resendClient;
}

function emailConfig() {
  const from = process.env.EMAIL_FROM;
  const organiser = process.env.BOOKING_ADMIN_EMAIL;
  const siteUrl = process.env.SITE_URL?.replace(/\/$/, "");
  if (!from || !organiser || !siteUrl) throw new Error("Email configuration is incomplete");
  return { from, organiser, siteUrl };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function layout(preview: string, heading: string, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(preview)}</title></head><body style="margin:0;background:#f6f1e7;color:#14231d;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:36px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fffdf8;border:1px solid #e5ded0"><tr><td style="height:8px;background:#163b2d"></td></tr><tr><td style="padding:38px 34px"><p style="margin:0 0 12px;color:#a27838;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase">United for God</p><h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:34px;font-weight:500;line-height:1.15">${escapeHtml(heading)}</h1>${body}<p style="margin:32px 0 0;padding-top:22px;border-top:1px solid #e5ded0;color:#607069;font-size:13px;line-height:1.6">24 Hours at the Feet of God<br>${escapeHtml(LOCATION)}</p></td></tr></table></td></tr></table></body></html>`;
}

function bookingDetails(reservation: Reservation) {
  const slot = getSlot(reservation.slot_id);
  if (!slot) throw new Error("Unknown reservation slot");
  return { slot, label: `Slot ${String(slot.number).padStart(2, "0")} · ${slot.timeLabel} · ${slot.dayLabel}, ${slot.dateLabel}` };
}

export async function sendBookingEmails(
  reservation: Reservation,
  cancellationToken: string,
  options: { notifyOrganiser?: boolean; scheduleReminder?: boolean } = {},
) {
  if (!reservation.attendee_email || !reservation.attendee_name) throw new Error("Reservation has no attendee details");
  const resend = getResend();
  const config = emailConfig();
  const { slot, label } = bookingDetails(reservation);
  const cancelUrl = `${config.siteUrl}/cancel/${encodeURIComponent(cancellationToken)}`;
  const attempt = reservation.email_attempt;

  const confirmation = await resend.emails.send({
    from: config.from,
    to: reservation.attendee_email,
    subject: `Prayer slot confirmed — ${slot.timeLabel}`,
    html: layout(
      `Your prayer slot is confirmed for ${slot.timeLabel}`,
      "Your prayer slot is confirmed",
      `<p style="font-size:17px;line-height:1.7">Hello ${escapeHtml(reservation.attendee_name)},</p><p style="font-size:17px;line-height:1.7">Thank you for joining us in prayer. Your reservation is confirmed.</p><div style="margin:26px 0;padding:20px;border-left:5px solid #cba461;background:#f6f1e7"><strong style="font-size:18px">${escapeHtml(label)}</strong></div><p style="font-size:15px;line-height:1.7">A calendar invitation is attached. If you can no longer attend, please <a href="${escapeHtml(cancelUrl)}" style="color:#a27838">cancel your reservation</a> so the time can be offered to someone else.</p>`,
    ),
    attachments: [{
      filename: "prayer-slot.ics",
      content: Buffer.from(createCalendarInvite(reservation, "REQUEST")),
      contentType: "text/calendar; charset=utf-8; method=REQUEST",
    }],
  }, { idempotencyKey: `confirmation-${reservation.id}-${attempt}` });

  if (confirmation.error) throw new Error(`Confirmation email failed: ${confirmation.error.name}`);

  let organiserEmailId: string | null = null;
  let hadDeliveryDelay = false;
  if (options.notifyOrganiser !== false) {
    const organiser = await resend.emails.send({
      from: config.from,
      to: config.organiser,
      subject: `New prayer booking — ${label}`,
      html: layout(
        `New booking for ${slot.timeLabel}`,
        "A prayer slot has been reserved",
        `<p style="font-size:16px;line-height:1.7"><strong>${escapeHtml(label)}</strong></p><p style="font-size:16px;line-height:1.7">${escapeHtml(reservation.attendee_name)}<br>${escapeHtml(reservation.attendee_email)}<br>${escapeHtml(reservation.attendee_phone ?? "No phone supplied")}</p>`,
      ),
    }, { idempotencyKey: `organiser-booking-${reservation.id}` });
    if (organiser.error) {
      hadDeliveryDelay = true;
      console.error("Organiser booking email failed", organiser.error.name);
    } else {
      organiserEmailId = organiser.data.id;
    }
  }

  let reminderEmailId: string | null = reservation.reminder_email_id;
  const reminderAt = new Date(Date.parse(slot.start) - 24 * 60 * 60 * 1000);
  if (options.scheduleReminder !== false && !reminderEmailId && reminderAt.getTime() > Date.now()) {
    const reminder = await resend.emails.send({
      from: config.from,
      to: reservation.attendee_email,
      subject: `Reminder — your prayer slot is tomorrow at ${slot.timeLabel.split(" – ")[0]}`,
      html: layout(
        `Your prayer slot begins in 24 hours`,
        "Your prayer slot is tomorrow",
        `<p style="font-size:17px;line-height:1.7">Hello ${escapeHtml(reservation.attendee_name)},</p><p style="font-size:17px;line-height:1.7">This is a reminder that your prayer time begins in 24 hours.</p><div style="margin:26px 0;padding:20px;border-left:5px solid #cba461;background:#f6f1e7"><strong style="font-size:18px">${escapeHtml(label)}</strong></div><p style="font-size:15px"><a href="${escapeHtml(cancelUrl)}" style="color:#a27838">Cancel this reservation</a></p>`,
      ),
      scheduledAt: reminderAt.toISOString(),
    }, { idempotencyKey: `reminder-${reservation.id}` });
    if (reminder.error) {
      hadDeliveryDelay = true;
      console.error("Reminder scheduling failed", reminder.error.name);
    } else {
      reminderEmailId = reminder.data.id;
    }
  }

  return {
    confirmationEmailId: confirmation.data.id,
    organiserEmailId,
    reminderEmailId,
    hadDeliveryDelay,
  };
}

export async function cancelScheduledReminder(emailId: string | null) {
  if (!emailId) return;
  try {
    const result = await getResend().emails.cancel(emailId);
    if (result.error && result.error.name !== "not_found") {
      console.error("Unable to cancel scheduled reminder", result.error.name);
    }
  } catch (error) {
    console.error("Unable to cancel scheduled reminder", error);
  }
}

export async function sendCancellationEmails(reservation: Reservation) {
  if (!reservation.attendee_email || !reservation.attendee_name) return;
  const resend = getResend();
  const config = emailConfig();
  const { slot, label } = bookingDetails(reservation);
  const attendee = await resend.emails.send({
    from: config.from,
    to: reservation.attendee_email,
    subject: `Prayer slot cancelled — ${slot.timeLabel}`,
    html: layout(
      `Your prayer slot has been cancelled`,
      "Your reservation is cancelled",
      `<p style="font-size:17px;line-height:1.7">Hello ${escapeHtml(reservation.attendee_name)},</p><p style="font-size:17px;line-height:1.7">Your reservation for <strong>${escapeHtml(label)}</strong> has been cancelled. The time is now available for someone else.</p>`,
    ),
    attachments: [{
      filename: "prayer-slot-cancellation.ics",
      content: Buffer.from(createCalendarInvite(reservation, "CANCEL")),
      contentType: "text/calendar; charset=utf-8; method=CANCEL",
    }],
  }, { idempotencyKey: `cancellation-${reservation.id}` });
  if (attendee.error) console.error("Attendee cancellation email failed", attendee.error.name);

  const organiser = await resend.emails.send({
    from: config.from,
    to: config.organiser,
    subject: `Prayer booking cancelled — ${label}`,
    html: layout(
      `Cancellation for ${slot.timeLabel}`,
      "A prayer reservation was cancelled",
      `<p style="font-size:16px;line-height:1.7"><strong>${escapeHtml(label)}</strong></p><p style="font-size:16px;line-height:1.7">${escapeHtml(reservation.attendee_name)} · ${escapeHtml(reservation.attendee_email)}</p>`,
    ),
  }, { idempotencyKey: `organiser-cancellation-${reservation.id}` });
  if (organiser.error) console.error("Organiser cancellation email failed", organiser.error.name);
}
