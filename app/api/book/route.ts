import { sendBookingEmails } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { createReservation, updateEmailResult } from "@/lib/reservations";
import { validateBookingPayload } from "@/lib/validation";

export const runtime = "nodejs";

function getClientAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

export async function POST(request: Request) {
  const rateLimit = checkRateLimit(getClientAddress(request));
  if (!rateLimit.allowed) {
    return Response.json(
      { message: "Too many booking attempts. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "Invalid booking request." }, { status: 400 });
  }

  const validated = validateBookingPayload(body);
  if (!validated.success) {
    return Response.json({ message: validated.message }, { status: 400 });
  }

  if (process.env.BOOKING_ENABLED !== "true") {
    return Response.json(
      { message: "Online booking is temporarily paused while we update the schedule." },
      { status: 503 },
    );
  }

  try {
    const result = await createReservation(validated.data);
    if (!result.ok) {
      return Response.json(
        { message: result.reason === "unavailable"
          ? "Someone has just booked this prayer slot. Please choose another one."
          : "Please choose a valid prayer slot." },
        { status: result.reason === "unavailable" ? 409 : 400 },
      );
    }

    try {
      const email = await sendBookingEmails(result.reservation, result.cancellationToken, {
        notifyOrganiser: true,
        scheduleReminder: true,
      });
      await updateEmailResult(result.reservation.id, {
        ...email,
        emailStatus: email.hadDeliveryDelay ? "delayed" : "sent",
      });
      return Response.json({ success: true, emailDelayed: email.hadDeliveryDelay }, { status: 201 });
    } catch (emailError) {
      console.error("Reservation saved but email delivery was delayed", emailError);
      await updateEmailResult(result.reservation.id, { emailStatus: "delayed" }).catch((error) => {
        console.error("Unable to record delayed email status", error);
      });
      return Response.json({
        success: true,
        emailDelayed: true,
        message: "Your slot is reserved, but the confirmation email is delayed. The organiser can resend it.",
      }, { status: 201 });
    }
  } catch (error) {
    console.error("Reservation database request failed", error);
    return Response.json(
      { message: "Booking is temporarily unavailable. No reservation was created; please try again shortly." },
      { status: 503 },
    );
  }
}
