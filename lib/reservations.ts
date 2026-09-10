import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getReservationsTable, getSql, isUniqueViolation } from "./db";
import { getSlot, slots, toPublicSlot, type PublicSlot } from "./slots";
import type { BookingPayload } from "./validation";

export type ReservationKind = "booking" | "block";
export type ReservationStatus = "active" | "cancelled" | "released";
export type EmailStatus = "pending" | "sent" | "delayed" | "not_applicable";

export type Reservation = {
  id: string;
  slot_id: string;
  kind: ReservationKind;
  status: ReservationStatus;
  attendee_name: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  attendee_timezone: string | null;
  source: string;
  cancellation_token_hash: string | null;
  booking_uid: string;
  confirmation_email_id: string | null;
  organiser_email_id: string | null;
  reminder_email_id: string | null;
  email_status: EmailStatus;
  email_attempt: number;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
  cancelled_by: string | null;
  pii_purged_at: string | null;
};

export function hashCancellationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function getPublicSlots(): Promise<PublicSlot[]> {
  if (process.env.BOOKING_ENABLED !== "true") {
    return slots.map((slot) => toPublicSlot(slot, false));
  }
  try {
    const sql = getSql();
    const table = getReservationsTable(sql);
    const rows = await sql`SELECT slot_id FROM ${table} WHERE status = 'active'`;
    const occupied = new Set(rows.map((row) => String(row.slot_id)));
    return slots.map((slot) => toPublicSlot(slot, !occupied.has(slot.id)));
  } catch (error) {
    console.error("Unable to load reservation availability", error);
    return slots.map((slot) => toPublicSlot(slot, false));
  }
}

export async function createReservation(input: BookingPayload) {
  const slot = getSlot(input.slotId);
  if (!slot) return { ok: false as const, reason: "invalid" as const };

  const id = randomUUID();
  const cancellationToken = randomBytes(32).toString("base64url");
  const cancellationTokenHash = hashCancellationToken(cancellationToken);
  const bookingUid = `${id}@unitedforgod.co.uk`;

  try {
    const sql = getSql();
    const table = getReservationsTable(sql);
    const rows = await sql`
      INSERT INTO ${table} (
        id, slot_id, kind, status, attendee_name, attendee_email,
        attendee_phone, attendee_timezone, source, cancellation_token_hash,
        booking_uid, email_status
      ) VALUES (
        ${id}::uuid, ${slot.id}, 'booking', 'active', ${input.name}, ${input.email},
        ${input.phone}, ${input.timezone}, 'website', ${cancellationTokenHash},
        ${bookingUid}, 'pending'
      )
      RETURNING *
    `;
    return {
      ok: true as const,
      reservation: rows[0] as unknown as Reservation,
      cancellationToken,
    };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false as const, reason: "unavailable" as const };
    throw error;
  }
}

export async function updateEmailResult(
  id: string,
  values: {
    confirmationEmailId?: string | null;
    organiserEmailId?: string | null;
    reminderEmailId?: string | null;
    emailStatus: EmailStatus;
  },
) {
  const sql = getSql();
  const table = getReservationsTable(sql);
  await sql`
    UPDATE ${table} SET
      confirmation_email_id = COALESCE(${values.confirmationEmailId ?? null}, confirmation_email_id),
      organiser_email_id = COALESCE(${values.organiserEmailId ?? null}, organiser_email_id),
      reminder_email_id = COALESCE(${values.reminderEmailId ?? null}, reminder_email_id),
      email_status = ${values.emailStatus},
      updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
}

export async function rotateCancellationToken(id: string) {
  const token = randomBytes(32).toString("base64url");
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`
    UPDATE ${table} SET
      cancellation_token_hash = ${hashCancellationToken(token)},
      email_attempt = email_attempt + 1,
      email_status = 'pending',
      updated_at = NOW()
    WHERE id = ${id}::uuid AND status = 'active' AND kind = 'booking'
    RETURNING *
  `;
  const reservation = rows[0] as unknown as Reservation | undefined;
  return reservation ? { reservation, cancellationToken: token } : undefined;
}

export async function getReservationByToken(token: string) {
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`
    SELECT * FROM ${table} WHERE cancellation_token_hash = ${hashCancellationToken(token)} LIMIT 1
  `;
  return rows[0] as unknown as Reservation | undefined;
}

export async function cancelReservationByToken(token: string) {
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`
    UPDATE ${table} SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'attendee', updated_at = NOW()
    WHERE cancellation_token_hash = ${hashCancellationToken(token)} AND status = 'active' AND kind = 'booking'
    RETURNING *
  `;
  return rows[0] as unknown as Reservation | undefined;
}

export async function listReservations() {
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`SELECT * FROM ${table} ORDER BY slot_id, created_at DESC`;
  return rows as unknown as Reservation[];
}

export async function getReservationById(id: string) {
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`SELECT * FROM ${table} WHERE id = ${id}::uuid LIMIT 1`;
  return rows[0] as unknown as Reservation | undefined;
}

export async function cancelReservationById(id: string) {
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`
    UPDATE ${table} SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = 'admin', updated_at = NOW()
    WHERE id = ${id}::uuid AND status = 'active' AND kind = 'booking'
    RETURNING *
  `;
  return rows[0] as unknown as Reservation | undefined;
}

export async function releaseBlockedReservation(id: string) {
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`
    UPDATE ${table} SET status = 'released', updated_at = NOW()
    WHERE id = ${id}::uuid AND status = 'active' AND kind = 'block'
    RETURNING *
  `;
  return rows[0] as unknown as Reservation | undefined;
}

export async function createBlockedReservation(slotId: string) {
  if (!getSlot(slotId)) return undefined;
  const id = randomUUID();
  try {
    const sql = getSql();
    const table = getReservationsTable(sql);
    const rows = await sql`
      INSERT INTO ${table} (
        id, slot_id, kind, status, source, booking_uid, email_status
      ) VALUES (
        ${id}::uuid, ${slotId}, 'block', 'active', 'admin',
        ${`${id}@unitedforgod.co.uk`}, 'not_applicable'
      )
      RETURNING *
    `;
    return rows[0] as unknown as Reservation | undefined;
  } catch (error) {
    if (isUniqueViolation(error)) return undefined;
    throw error;
  }
}

export async function attachAttendeeToBlock(
  id: string,
  attendee: { name: string; email: string; phone: string; timezone: string },
) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashCancellationToken(token);
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`
    UPDATE ${table} SET
      kind = 'booking', attendee_name = ${attendee.name}, attendee_email = ${attendee.email},
      attendee_phone = ${attendee.phone}, attendee_timezone = ${attendee.timezone},
      source = 'admin', cancellation_token_hash = ${tokenHash}, email_status = 'pending', updated_at = NOW()
    WHERE id = ${id}::uuid AND status = 'active' AND kind = 'block'
    RETURNING *
  `;
  const reservation = rows[0] as unknown as Reservation | undefined;
  return reservation ? { reservation, cancellationToken: token } : undefined;
}

export async function purgeReservationPii(id: string) {
  const sql = getSql();
  const table = getReservationsTable(sql);
  const rows = await sql`
    UPDATE ${table} SET
      attendee_name = NULL, attendee_email = NULL, attendee_phone = NULL,
      attendee_timezone = NULL, cancellation_token_hash = NULL, pii_purged_at = NOW(), updated_at = NOW()
    WHERE id = ${id}::uuid AND status <> 'active'
    RETURNING id
  `;
  return rows.length > 0;
}
