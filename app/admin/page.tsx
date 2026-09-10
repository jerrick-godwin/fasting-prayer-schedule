import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getSlot, slots } from "@/lib/slots";
import { listReservations } from "@/lib/reservations";
import {
  attachAttendeeAction,
  blockSlotAction,
  cancelBookingAction,
  logoutAction,
  purgePiiAction,
  releaseBlockAction,
  resendConfirmationAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const [reservations, query] = await Promise.all([listReservations(), searchParams]);
  const active = reservations.filter((item) => item.status === "active");
  const booked = active.filter((item) => item.kind === "booking").length;
  const blocked = active.filter((item) => item.kind === "block").length;
  const cancelled = reservations.filter((item) => item.status === "cancelled").length;
  const available = slots.length - active.length;
  const activeBySlot = new Map(active.map((reservation) => [reservation.slot_id, reservation]));

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div><p className="eyebrow">United for God</p><h1>Booking dashboard</h1></div>
        <div className="admin-header__actions"><a href="/api/admin/bookings.csv">Export CSV</a><form action={logoutAction}><button type="submit">Sign out</button></form></div>
      </header>
      {query.success ? <p className="admin-notice is-success">{query.success}</p> : null}
      {query.error ? <p className="admin-notice is-error">{query.error}</p> : null}
      <section className="admin-stats" aria-label="Booking totals">
        <div><strong>{available}</strong><span>Available</span></div>
        <div><strong>{booked}</strong><span>Booked</span></div>
        <div><strong>{blocked}</strong><span>Blocked</span></div>
        <div><strong>{cancelled}</strong><span>Cancelled</span></div>
      </section>
      <section className="admin-slot-manager" aria-labelledby="slot-manager-title">
        <div className="admin-slot-manager__heading">
          <div><p className="eyebrow">Schedule controls</p><h2 id="slot-manager-title">Manage slot availability</h2></div>
          <p>Changes are stored in Neon and reflected on the booking page immediately.</p>
        </div>
        <div className="admin-slot-grid">
          {slots.map((slot) => {
            const current = activeBySlot.get(slot.id);
            const state = current?.kind === "booking" ? "Booked" : current ? "Blocked" : "Available";
            return (
              <article className="admin-slot-card" key={slot.id}>
                <div><strong>Slot {String(slot.number).padStart(2, "0")}</strong><small>{slot.timeLabel}</small></div>
                <span className={`admin-status admin-status--${state.toLowerCase()}`}>{state}</span>
                {!current ? (
                  <form action={blockSlotAction}>
                    <input type="hidden" name="slotId" value={slot.id} />
                    <button type="submit">Mark booked</button>
                  </form>
                ) : current.kind === "block" ? (
                  <form action={releaseBlockAction}>
                    <input type="hidden" name="id" value={current.id} />
                    <button type="submit">Make available</button>
                  </form>
                ) : <small className="admin-slot-card__hint">Manage in the bookings table</small>}
              </article>
            );
          })}
        </div>
      </section>
      <section className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Slot</th><th>Status</th><th>Attendee</th><th>Contact</th><th>Email</th><th>Actions</th></tr></thead>
          <tbody>{reservations.map((reservation) => {
            const slot = getSlot(reservation.slot_id);
            return (
              <tr key={reservation.id}>
                <td><strong>{slot ? `Slot ${String(slot.number).padStart(2, "0")}` : reservation.slot_id}</strong><small>{slot?.timeLabel}</small></td>
                <td><span className={`admin-status admin-status--${reservation.status}`}>{reservation.kind === "block" && reservation.status === "active" ? "blocked" : reservation.status}</span><small>{reservation.source}</small></td>
                <td>{reservation.attendee_name ?? (reservation.pii_purged_at ? "Details purged" : "—")}</td>
                <td>{reservation.attendee_email ? <><a href={`mailto:${reservation.attendee_email}`}>{reservation.attendee_email}</a><small>{reservation.attendee_phone}</small></> : "—"}</td>
                <td>{reservation.email_status.replace("_", " ")}</td>
                <td className="admin-actions">
                  {reservation.status === "active" && reservation.kind === "booking" ? <>
                    <form action={resendConfirmationAction}><input type="hidden" name="id" value={reservation.id} /><button type="submit">Resend</button></form>
                    <details className="confirm-details"><summary>Cancel</summary><form action={cancelBookingAction}><input type="hidden" name="id" value={reservation.id} /><button className="is-danger" type="submit">Confirm cancellation</button></form></details>
                  </> : null}
                  {reservation.status === "active" && reservation.kind === "block" ? <>
                    <form action={releaseBlockAction}><input type="hidden" name="id" value={reservation.id} /><button type="submit">Release</button></form>
                    <details className="attach-details"><summary>Add attendee</summary><form action={attachAttendeeAction}>
                      <input type="hidden" name="id" value={reservation.id} />
                      <input name="name" placeholder="Full name" required />
                      <input name="email" type="email" placeholder="Email" required />
                      <input name="phone" type="tel" placeholder="Phone" required />
                      <input name="timezone" value="Europe/London" readOnly />
                      <button type="submit">Attach &amp; send</button>
                    </form></details>
                  </> : null}
                  {reservation.status !== "active" && !reservation.pii_purged_at && reservation.attendee_email ? <details className="confirm-details"><summary>Purge details</summary><form action={purgePiiAction}><input type="hidden" name="id" value={reservation.id} /><button className="is-danger" type="submit">Permanently purge</button></form></details> : null}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </section>
    </main>
  );
}
