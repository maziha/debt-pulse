-- Phase 0: allow safe upsert-based reminder generation without duplicating rows.
-- The client re-runs reminder generation on every dashboard visit; this unique
-- index lets it upsert (user_id, payment_id, due_date) and skip existing rows
-- instead of inserting a fresh duplicate notification every time.
create unique index if not exists notifications_dedupe_idx
  on public.notifications (user_id, payment_id, due_date)
  where payment_id is not null and due_date is not null;
