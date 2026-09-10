import { createCalendlyBooking } from "@/lib/calendly";
import { checkRateLimit } from "@/lib/rate-limit";
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

  const result = await createCalendlyBooking(validated.data);
  if (result.ok) return Response.json({ success: true }, { status: 201 });

  if (result.reason === "rate_limited") {
    return Response.json(
      { message: result.message },
      {
        status: 429,
        headers: result.retryAfter
          ? { "Retry-After": String(result.retryAfter) }
          : undefined,
      },
    );
  }

  return Response.json(
    { message: result.message },
    { status: result.reason === "unavailable" ? 409 : 503 },
  );
}
