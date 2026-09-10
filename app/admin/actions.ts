"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearAdminSession, createAdminSession, isAdminAuthenticated, verifyAdminPassword } from "@/lib/admin-auth";
import { cancelScheduledReminder, sendBookingEmails, sendCancellationEmails } from "@/lib/email";
import {
  attachAttendeeToBlock,
  cancelReservationById,
  createBlockedReservation,
  getReservationById,
  purgeReservationPii,
  releaseBlockedReservation,
  rotateCancellationToken,
  updateEmailResult,
} from "@/lib/reservations";
import { getSlot } from "@/lib/slots";
import { validateBookingPayload } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function reservationId(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  return UUID_PATTERN.test(id) ? id : null;
}

async function requireAdmin() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

function adminRedirect(message: string, type: "success" | "error" = "success"): never {
  redirect(`/admin?${type}=${encodeURIComponent(message)}`);
}

export async function loginAction(formData: FormData) {
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!checkRateLimit(`admin-login:${address}`).allowed) {
    redirect("/admin/login?error=Too%20many%20attempts.%20Please%20wait%20and%20try%20again.");
  }
  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) redirect("/admin/login?error=Incorrect%20password");
  await createAdminSession();
  redirect("/admin");
}

export async function logoutAction() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function cancelBookingAction(formData: FormData) {
  await requireAdmin();
  const id = reservationId(formData);
  if (!id) adminRedirect("Invalid reservation.", "error");
  const reservation = await cancelReservationById(id);
  if (!reservation) adminRedirect("That booking is no longer active.", "error");
  await cancelScheduledReminder(reservation.reminder_email_id);
  await sendCancellationEmails(reservation).catch((error) => console.error("Admin cancellation email failed", error));
  revalidatePath("/admin");
  adminRedirect("Booking cancelled and the slot reopened.");
}

export async function releaseBlockAction(formData: FormData) {
  await requireAdmin();
  const id = reservationId(formData);
  if (!id || !(await releaseBlockedReservation(id))) adminRedirect("That block is no longer active.", "error");
  revalidatePath("/admin");
  adminRedirect("Blocked slot released.");
}

export async function blockSlotAction(formData: FormData) {
  await requireAdmin();
  const slotId = String(formData.get("slotId") ?? "");
  if (!getSlot(slotId)) adminRedirect("Invalid prayer slot.", "error");
  const reservation = await createBlockedReservation(slotId);
  if (!reservation) adminRedirect("That slot is already booked or blocked.", "error");
  revalidatePath("/admin");
  revalidatePath("/");
  adminRedirect("Slot marked as booked.");
}

export async function attachAttendeeAction(formData: FormData) {
  await requireAdmin();
  const id = reservationId(formData);
  if (!id) adminRedirect("Invalid reservation.", "error");
  const block = await getReservationById(id);
  if (!block || block.kind !== "block" || block.status !== "active") adminRedirect("That block is no longer active.", "error");
  const validated = validateBookingPayload({
    slotId: block.slot_id,
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    timezone: formData.get("timezone") || "Europe/London",
    website: "",
  });
  if (!validated.success) adminRedirect(validated.message, "error");
  const attached = await attachAttendeeToBlock(id, validated.data);
  if (!attached) adminRedirect("Unable to attach attendee details.", "error");
  let deliveryDelayed = false;
  try {
    const email = await sendBookingEmails(attached.reservation, attached.cancellationToken);
    deliveryDelayed = email.hadDeliveryDelay;
    await updateEmailResult(id, { ...email, emailStatus: email.hadDeliveryDelay ? "delayed" : "sent" });
  } catch (error) {
    console.error("Attached attendee email failed", error);
    await updateEmailResult(id, { emailStatus: "delayed" });
    revalidatePath("/admin");
    adminRedirect("Attendee attached, but email delivery is delayed.", "error");
  }
  revalidatePath("/admin");
  if (deliveryDelayed) adminRedirect("Attendee attached and confirmed, but one notification or reminder is delayed.", "error");
  adminRedirect("Attendee attached and confirmation sent.");
}

export async function resendConfirmationAction(formData: FormData) {
  await requireAdmin();
  const id = reservationId(formData);
  if (!id) adminRedirect("Invalid reservation.", "error");
  const rotated = await rotateCancellationToken(id);
  if (!rotated) adminRedirect("That booking cannot be resent.", "error");
  let deliveryDelayed = false;
  try {
    const email = await sendBookingEmails(rotated.reservation, rotated.cancellationToken, {
      notifyOrganiser: !rotated.reservation.organiser_email_id,
      scheduleReminder: !rotated.reservation.reminder_email_id,
    });
    deliveryDelayed = email.hadDeliveryDelay;
    await updateEmailResult(id, { ...email, emailStatus: email.hadDeliveryDelay ? "delayed" : "sent" });
  } catch (error) {
    console.error("Confirmation resend failed", error);
    await updateEmailResult(id, { emailStatus: "delayed" });
    revalidatePath("/admin");
    adminRedirect("Confirmation could not be resent.", "error");
  }
  revalidatePath("/admin");
  if (deliveryDelayed) adminRedirect("Confirmation sent, but one notification or reminder is still delayed.", "error");
  adminRedirect("Confirmation resent with a new cancellation link.");
}

export async function purgePiiAction(formData: FormData) {
  await requireAdmin();
  const id = reservationId(formData);
  if (!id || !(await purgeReservationPii(id))) adminRedirect("Only inactive reservations can be purged.", "error");
  revalidatePath("/admin");
  adminRedirect("Personal details permanently removed.");
}
