import { getReservationByToken } from "@/lib/reservations";
import { getSlot } from "@/lib/slots";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CancellationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  let reservation;
  try {
    reservation = await getReservationByToken(token);
  } catch (error) {
    console.error("Unable to load cancellation page", error);
    return <CancellationShell title="Cancellation is temporarily unavailable" message="Please try this link again shortly or contact the organiser." />;
  }

  if (!reservation) return <CancellationShell title="This cancellation link is invalid" message="The link may have been replaced. Please contact the organiser if you need help." />;
  const slot = getSlot(reservation.slot_id);
  if (query.status === "cancelled" || reservation.status === "cancelled") {
    return <CancellationShell title="Your reservation is cancelled" message="The prayer slot is now available for someone else." />;
  }
  if (reservation.status !== "active" || reservation.kind !== "booking" || !slot) {
    return <CancellationShell title="This reservation is no longer active" message="No changes were made." />;
  }

  return (
    <main className="cancel-page">
      <section className="cancel-card">
        <p className="eyebrow">24 Hours at the Feet of God</p>
        <h1>Cancel your prayer slot?</h1>
        <p>This will immediately make the time available to another person.</p>
        <div className={`modal-slot modal-slot--${slot.tone}`}>
          <strong>{slot.timeLabel}</strong>
          <span>{slot.dayLabel}, {slot.dateLabel}</span>
        </div>
        <form action="/api/cancel" method="post">
          <input type="hidden" name="token" value={token} />
          <button className="submit-button is-danger" type="submit">Yes, cancel my reservation</button>
        </form>
        <Link className="cancel-back-link" href="/">Keep my reservation</Link>
      </section>
    </main>
  );
}

function CancellationShell({ title, message }: { title: string; message: string }) {
  return <main className="cancel-page"><section className="cancel-card"><p className="eyebrow">United for God</p><h1>{title}</h1><p>{message}</p><Link className="submit-button cancel-home-link" href="/">Return to the schedule</Link></section></main>;
}
