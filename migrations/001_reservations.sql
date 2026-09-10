CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY,
  slot_id text NOT NULL CHECK (slot_id ~ '^slot-[1-9]$'),
  kind text NOT NULL CHECK (kind IN ('booking', 'block')),
  status text NOT NULL CHECK (status IN ('active', 'cancelled', 'released')),
  attendee_name text,
  attendee_email text,
  attendee_phone text,
  attendee_timezone text,
  source text NOT NULL,
  cancellation_token_hash text UNIQUE,
  booking_uid text NOT NULL UNIQUE,
  confirmation_email_id text,
  organiser_email_id text,
  reminder_email_id text,
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending', 'sent', 'delayed', 'not_applicable')),
  email_attempt integer NOT NULL DEFAULT 0 CHECK (email_attempt >= 0),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  cancelled_at timestamptz,
  cancelled_by text,
  pii_purged_at timestamptz
);

-- statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS reservations_one_active_per_slot
  ON reservations (slot_id) WHERE status = 'active';

-- statement-breakpoint
CREATE INDEX IF NOT EXISTS reservations_status_idx ON reservations (status);
