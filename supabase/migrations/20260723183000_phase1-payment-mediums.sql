-- Phase 1: payment mediums — credit cards, insurance category, payment method,
-- investments (SIP/FD/etc.), and receivables (peer loans + chit payouts).

-- ── Expand payment categories ──────────────────────────────────────────────
alter table public.payments drop constraint if exists payments_category_check;
alter table public.payments add constraint payments_category_check
  check (category in (
    'debt_emi',
    'recurring_expense',
    'one_time_expense',
    'chit_fund',
    'loan',
    'subscription',
    'credit_card',
    'insurance'
  ));

-- ── How each payment is actually paid ──────────────────────────────────────
alter table public.payments
  add column if not exists payment_method text
    check (payment_method is null or payment_method in (
      'upi', 'auto_debit', 'bank_transfer', 'cash', 'wallet', 'cheque', 'card'
    ));

-- ── Credit cards ───────────────────────────────────────────────────────────
create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null,
  card_name text not null,
  last4 text,
  credit_limit numeric(14,2) not null default 0,
  outstanding_balance numeric(14,2) not null default 0,
  statement_day integer check (statement_day between 1 and 31),
  due_day integer not null check (due_day between 1 and 31),
  apr numeric(6,3),
  status text not null default 'active' check (status in ('active','closed','paused')),
  notes text,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.credit_cards to authenticated;
grant all on public.credit_cards to service_role;
alter table public.credit_cards enable row level security;
create policy "own credit cards" on public.credit_cards for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists credit_cards_user_idx on public.credit_cards(user_id);
create trigger credit_cards_updated before update on public.credit_cards
  for each row execute function public.update_updated_at_column();

-- Optional link from a payment (e.g. card bill EMI) to a card
alter table public.payments
  add column if not exists credit_card_id uuid references public.credit_cards(id) on delete set null;

-- ── Investments (money saved, not spent) ───────────────────────────────────
create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('sip','mutual_fund','fd','rd','ppf','epf','nps','stocks','other')),
  current_value numeric(14,2) not null default 0,
  contribution_amount numeric(14,2),
  contribution_frequency text check (contribution_frequency is null or contribution_frequency in ('monthly','weekly','yearly','one_time')),
  contribution_day integer check (contribution_day is null or contribution_day between 1 and 31),
  start_date date,
  maturity_date date,
  notes text,
  tag text,
  status text not null default 'active' check (status in ('active','matured','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.investments to authenticated;
grant all on public.investments to service_role;
alter table public.investments enable row level security;
create policy "own investments" on public.investments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists investments_user_idx on public.investments(user_id);
create trigger investments_updated before update on public.investments
  for each row execute function public.update_updated_at_column();

-- ── Receivables (money owed TO you) ────────────────────────────────────────
-- kind = peer_loan  → money lent to someone
-- kind = chit_payout → lump sum expected when your chit fund turn arrives
create table if not exists public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('peer_loan','chit_payout')),
  name text not null,
  person text,
  amount numeric(14,2) not null,
  expected_date date,
  status text not null default 'pending' check (status in ('pending','partial','received','written_off')),
  amount_received numeric(14,2),
  received_date date,
  linked_payment_id uuid references public.payments(id) on delete set null,
  notes text,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.receivables to authenticated;
grant all on public.receivables to service_role;
alter table public.receivables enable row level security;
create policy "own receivables" on public.receivables for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists receivables_user_idx on public.receivables(user_id);
create trigger receivables_updated before update on public.receivables
  for each row execute function public.update_updated_at_column();
