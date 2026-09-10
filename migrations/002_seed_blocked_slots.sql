INSERT INTO reservations (id, slot_id, kind, status, source, booking_uid, email_status)
VALUES
  ('9a1d7a37-532e-4c0c-9dc9-00275e290001', 'slot-1', 'block', 'active', 'seed', 'slot-1-block@unitedforgod.co.uk', 'not_applicable'),
  ('9a1d7a37-532e-4c0c-9dc9-00275e290003', 'slot-3', 'block', 'active', 'seed', 'slot-3-block@unitedforgod.co.uk', 'not_applicable'),
  ('9a1d7a37-532e-4c0c-9dc9-00275e290005', 'slot-5', 'block', 'active', 'seed', 'slot-5-block@unitedforgod.co.uk', 'not_applicable'),
  ('9a1d7a37-532e-4c0c-9dc9-00275e290009', 'slot-9', 'block', 'active', 'seed', 'slot-9-block@unitedforgod.co.uk', 'not_applicable')
ON CONFLICT DO NOTHING;
