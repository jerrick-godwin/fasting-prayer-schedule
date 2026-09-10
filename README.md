# UK Fasting & Prayer booking page

A custom Next.js booking page for the 18–19 September 2026 prayer schedule. Neon Postgres owns availability and reservations; Resend sends confirmations, organiser notifications, reminders, cancellations, and calendar invitations.

## Configuration

Copy `.env.example` to `.env.local` for local development. Keep all values server-only and configure the same keys in Vercel for Production:

```dotenv
DATABASE_URL=
RESEND_API_KEY=
EMAIL_FROM=United for God <bookings@unitedforgod.co.uk>
BOOKING_ADMIN_EMAIL=
ADMIN_PASSWORD_HASH=
ADMIN_SESSION_SECRET=
SITE_URL=https://www.unitedforgod.co.uk
BOOKING_ENABLED=false
```

- `DATABASE_URL`: pooled Neon connection string.
- `RESEND_API_KEY`: server-side Resend key.
- `EMAIL_FROM`: sender on a verified Resend domain.
- `BOOKING_ADMIN_EMAIL`: receives booking and cancellation notifications.
- `ADMIN_PASSWORD_HASH`: generated with `npm run admin:hash-password`. Use the script's escaped form in `.env.local`, because Next.js expands unescaped `$` characters. Use the raw form in Vercel's environment-variable dashboard.
- `ADMIN_SESSION_SECRET`: a random value of at least 32 characters.
- `SITE_URL`: canonical public origin used in cancellation links.
- `BOOKING_ENABLED`: keep `false` until migration checks pass, then set `true`.

Never commit `.env.local`. Vercel environment changes require a new deployment.

## Neon and Resend setup

1. Add Neon and Resend to the Vercel project through the Marketplace.
2. Pull development variables with `vercel env pull .env.local --environment=development`.
3. Add `unitedforgod.co.uk` in Resend and publish its SPF and DKIM records. Do not use the production `EMAIL_FROM` until the domain is verified.
4. Generate the password hash with `npm run admin:hash-password` and add its output to Vercel.
5. Generate `ADMIN_SESSION_SECRET` with a cryptographically secure random generator.
6. Apply the schema and four preset blocks with `npm run db:setup`.

The setup script is idempotent. It creates the initial Slot 1, 3, 5, and 9 database records as releasable blocks; no public booking status is hardcoded in the application. The database partial unique index ensures only one active reservation can exist for each slot. After setup, every slot can be marked booked or made available from `/admin` without changing or redeploying code.

## Importing the existing Slot 4 reservation

Keep public booking disabled. Run the one-time import with attendee values supplied only to the process environment:

```bash
IMPORT_SLOT_ID=slot-4 IMPORT_NAME="Attendee" IMPORT_EMAIL="attendee@example.com" IMPORT_PHONE="+44..." npm run db:import-reservation
```

Then open `/admin`, verify Slot 4, and choose **Resend**. This rotates in a secure cancellation token and sends the branded confirmation plus calendar invitation. Only after that succeeds should the old provider booking be cancelled. The fixed Slot 4 import ID makes reruns harmless.

## Admin dashboard

`/admin` uses an eight-hour signed, secure, HTTP-only cookie. It supports:

- booking, blocked, available, and cancelled totals;
- attendee and email status review;
- cancellation with attendee and organiser notifications;
- releasing preset blocks;
- marking any available slot as booked;
- attaching an attendee to a blocked slot;
- resending confirmation with a new cancellation link;
- active-booking CSV export; and
- permanent personal-detail purging for inactive reservations.

## Local development and verification

```bash
npm install
npm run dev
```

```bash
npm test
npm run lint
npm run build
```

For full local flow checks, the test harness creates a temporary Neon schema and uses a local Resend-compatible capture server. It never writes to the public reservations table or sends real email:

```bash
npm run test:local:start
npm run test:local:disabled
npm run test:local:db-failure
```

Stop each harness with `Ctrl+C`; it removes its temporary schema during shutdown. The local admin password printed by the harness is accepted only in non-production mode.

If Neon is unavailable, public availability fails closed and no attendee data is exposed. A confirmed database reservation is never removed when email delivery fails; the dashboard marks it delayed so an organiser can resend it.
