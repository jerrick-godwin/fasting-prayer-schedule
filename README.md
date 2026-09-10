# UK Fasting & Prayer booking page

A custom Next.js booking experience for the 18–19 September 2026 prayer schedule. Calendly remains the source of truth for live availability, bookings, notifications, cancellations, and calendar invitations.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

With `CALENDLY_ENABLED=false`, the site runs in preview mode: the supplied initial statuses are displayed, but booking submissions return a configuration message.

## Calendly setup

1. Use a Calendly Standard, Teams, or Enterprise account.
2. Create three private one-on-one event types with durations of 120, 180, and 235 minutes.
3. Limit their availability to the listed September 2026 prayer periods and add a required custom question named `Phone number`.
4. Ensure Slots 1, 3, and 9 are busy in the connected host calendar.
5. Generate a Calendly personal access token with `users:read`, `event_types:read`, `event_types:write`, `availability:read`, and `scheduled_events:write` scopes. The setup script needs the first three; the website needs event-type reading, availability reading, and booking access.
6. Copy `.env.example` to `.env.local`, enter the token and canonical event-type API URIs, then set `CALENDLY_ENABLED=true`.

Never expose `CALENDLY_TOKEN` through a `NEXT_PUBLIC_` variable or commit `.env.local`.

## Deploying to Vercel

1. Import this directory into Vercel as a Next.js project. The committed lockfile and pinned package versions make production installs repeatable.
2. In **Project Settings → Environment Variables**, add every key from `.env.example` for Production. Add the same values to Preview only if preview deployments should create real Calendly bookings.
3. Deploy again after adding or changing environment variables. Existing deployments do not receive new values automatically.

The page and its two API routes use Vercel's Node.js runtime in London (`lhr1`). Calendly requests time out after eight seconds, and slot responses deliberately use `no-store` so recently booked times are not served from a CDN cache. The built-in rate limit is a best-effort per-function-instance guard; for stronger distributed protection, configure a Vercel Firewall rate-limit rule for `POST /api/book`.

For local development, copy `.env.example` to `.env.local` and replace the placeholder values. To use the values configured on Vercel instead, link the project and run:

```bash
vercel env pull .env.local --environment=development
```

## Verification

```bash
npm test
npm run lint
npm run build
```
