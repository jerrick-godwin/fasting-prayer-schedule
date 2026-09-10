import { cancelScheduledReminder, sendCancellationEmails } from "@/lib/email";
import { cancelReservationByToken, getReservationByToken } from "@/lib/reservations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  const token = String(formData?.get("token") ?? "");
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return new Response("Invalid cancellation request", { status: 400 });

  try {
    const existing = await getReservationByToken(token);
    const reservation = await cancelReservationByToken(token);
    if (reservation) {
      await cancelScheduledReminder(reservation.reminder_email_id);
      await sendCancellationEmails(reservation).catch((error) => console.error("Cancellation email failed", error));
    }
    if (!existing) return new Response("Invalid cancellation link", { status: 404 });
    return Response.redirect(new URL(`/cancel/${encodeURIComponent(token)}?status=cancelled`, request.url), 303);
  } catch (error) {
    console.error("Cancellation request failed", error);
    return new Response("Cancellation is temporarily unavailable. Please try again.", { status: 503 });
  }
}
