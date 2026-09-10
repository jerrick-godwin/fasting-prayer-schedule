"use client";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <p className="eyebrow">Booking dashboard</p>
        <h1>Dashboard temporarily unavailable</h1>
        <p>The booking database could not be reached. No data has been changed.</p>
        <button className="submit-button" type="button" onClick={reset}>Try again</button>
      </section>
    </main>
  );
}
