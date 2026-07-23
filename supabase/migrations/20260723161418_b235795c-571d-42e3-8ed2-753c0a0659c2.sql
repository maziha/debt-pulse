
-- shared trigger fn
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_reminder_days integer not null default 2,
  daily_digest_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

-- auto profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null,
  currency text not null default 'INR',
  category text not null check (category in ('debt_emi','recurring_expense','one_time_expense','chit_fund','loan','subscription')),
  payment_type text not null check (payment_type in ('recurring','one_time')),
  frequency text check (frequency in ('monthly','weekly','yearly','custom')),
  day_of_month integer check (day_of_month between 1 and 31),
  custom_dates jsonb not null default '[]'::jsonb,
  start_date date,
  end_date date,
  end_date_confirmed boolean not null default false,
  status text not null default 'active' check (status in ('active','completed','paused','overdue')),
  linked_entity text,
  interest_rate numeric(6,3),
  principal_amount numeric(14,2),
  outstanding_balance numeric(14,2),
  notes text,
  created_from text not null default 'manual_form' check (created_from in ('natural_language','manual_form','file_import')),
  raw_input text,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "own payments" on public.payments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index payments_user_idx on public.payments(user_id);
create trigger payments_updated before update on public.payments
  for each row execute function public.update_updated_at_column();

-- payment_history
create table public.payment_history (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  due_date date not null,
  amount_due numeric(14,2) not null,
  amount_paid numeric(14,2),
  paid_date date,
  status text not null default 'pending' check (status in ('paid','missed','partial','pending')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payment_history to authenticated;
grant all on public.payment_history to service_role;
alter table public.payment_history enable row level security;
create policy "own history" on public.payment_history for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index payment_history_payment_idx on public.payment_history(payment_id);
create index payment_history_user_idx on public.payment_history(user_id);
create trigger payment_history_updated before update on public.payment_history
  for each row execute function public.update_updated_at_column();

-- income
create table public.income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  amount numeric(14,2) not null,
  currency text not null default 'INR',
  frequency text not null default 'one_time' check (frequency in ('monthly','one_time','weekly','yearly')),
  date_received date not null,
  notes text,
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.income to authenticated;
grant all on public.income to service_role;
alter table public.income enable row level security;
create policy "own income" on public.income for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index income_user_idx on public.income(user_id);
create trigger income_updated before update on public.income
  for each row execute function public.update_updated_at_column();

-- notifications (in-app)
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete cascade,
  message text not null,
  due_date date,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index notifications_user_idx on public.notifications(user_id, seen);
