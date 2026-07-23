-- Phase 3: edit-history / audit trail for payment changes.
create table if not exists public.payment_audit (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.payment_audit to authenticated;
grant all on public.payment_audit to service_role;
alter table public.payment_audit enable row level security;
create policy "own payment audit" on public.payment_audit for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists payment_audit_payment_idx on public.payment_audit(payment_id, created_at desc);
create index if not exists payment_audit_user_idx on public.payment_audit(user_id);
