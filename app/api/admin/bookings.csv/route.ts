import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listReservations } from "@/lib/reservations";

export const dynamic = "force-dynamic";

function csv(value: unknown) {
  let safe = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) return new Response("Unauthorized", { status: 401 });
  const reservations = (await listReservations()).filter((item) => item.status === "active");
  const lines = [
    ["slot", "type", "name", "email", "phone", "timezone", "source", "email_status", "created_at"],
    ...reservations.map((item) => [item.slot_id, item.kind, item.attendee_name, item.attendee_email, item.attendee_phone, item.attendee_timezone, item.source, item.email_status, item.created_at]),
  ];
  return new Response(lines.map((line) => line.map(csv).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="prayer-bookings.csv"',
      "Cache-Control": "no-store",
    },
  });
}
