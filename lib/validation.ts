export type BookingPayload = {
  slotId: string;
  name: string;
  email: string;
  phone: string;
  timezone: string;
  website: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d\s.-]{7,25}$/;

export function validateBookingPayload(value: unknown):
  | { success: true; data: BookingPayload }
  | { success: false; message: string } {
  if (!value || typeof value !== "object") {
    return { success: false, message: "Please complete the booking form." };
  }

  const input = value as Record<string, unknown>;
  const data: BookingPayload = {
    slotId: typeof input.slotId === "string" ? input.slotId.trim() : "",
    name: typeof input.name === "string" ? input.name.trim() : "",
    email: typeof input.email === "string" ? input.email.trim().toLowerCase() : "",
    phone: typeof input.phone === "string" ? input.phone.trim() : "",
    timezone: typeof input.timezone === "string" ? input.timezone.trim() : "Europe/London",
    website: typeof input.website === "string" ? input.website.trim() : "",
  };

  if (data.website) return { success: false, message: "Unable to submit this booking." };
  if (!/^slot-[1-9]$/.test(data.slotId)) {
    return { success: false, message: "Please choose a valid prayer slot." };
  }
  if (data.name.length < 2 || data.name.length > 100) {
    return { success: false, message: "Enter your full name." };
  }
  if (!EMAIL_PATTERN.test(data.email) || data.email.length > 254) {
    return { success: false, message: "Enter a valid email address." };
  }
  if (!PHONE_PATTERN.test(data.phone)) {
    return { success: false, message: "Enter a valid phone number." };
  }
  if (data.timezone.length > 100) {
    return { success: false, message: "Invalid timezone." };
  }

  return { success: true, data };
}
