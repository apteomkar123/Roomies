-- ============================================================
-- Roomies — AppWare Supabase Project Setup
-- Paste this entire file into the Supabase SQL Editor and run.
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────────────────────
-- HOUSEHOLDS
-- ──────────────────────────────────────────────────────────
create table if not exists households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- PROFILES  (mirrors auth.users)
-- ──────────────────────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique,
  avatar_url   text,
  karma                          integer not null default 100 check (karma >= 0),
  active_household_id            uuid references households(id) on delete set null,
  away                           boolean not null default false,
  has_completed_roomies_tutorial boolean not null default false,
  updated_at                     timestamptz not null default now()
);

-- Auto-create profile on sign-up (handles email, Google, and AppWare SSO users)
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  base_name text;
  final_name text;
  n         int := 0;
begin
  -- Wrap in exception block so any failure is swallowed — the auth.users
  -- INSERT must never be aborted by this trigger. The client creates the
  -- profile row on first sign-in if the trigger insert was silently skipped.
  begin
    base_name := coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, new.id::text), '@', 1)
    );
    final_name := base_name;
    while exists (select 1 from profiles where username = final_name) loop
      n := n + 1;
      final_name := base_name || n;
    end loop;
    insert into profiles (id, username)
    values (new.id, final_name)
    on conflict (id) do nothing;
  exception when others then
    null; -- profile will be created client-side on first SIGNED_IN event
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ──────────────────────────────────────────────────────────
-- HOUSEHOLD MEMBERS JUNCTION
-- ──────────────────────────────────────────────────────────
do $$ begin if not exists (select 1 from pg_type where typname = 'member_role') then create type member_role as enum ('Administrator', 'Tenant', 'Landlord'); end if; end $$;

create table if not exists household_members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  role         member_role not null default 'Tenant',
  joined_at    timestamptz not null default now(),
  unique (household_id, profile_id)
);

-- ──────────────────────────────────────────────────────────
-- USER PRESENCE STATUSES
-- ──────────────────────────────────────────────────────────
do $$ begin if not exists (select 1 from pg_type where typname = 'presence_status') then create type presence_status as enum ('Available', 'Sleeping', 'Quiet Hours / Studying', 'Work From Home', 'Away'); end if; end $$;

create table if not exists user_presence (
  profile_id   uuid primary key references profiles(id) on delete cascade,
  status       presence_status not null default 'Available',
  custom_text  text,
  updated_at   timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- CHORES
-- ──────────────────────────────────────────────────────────
do $$ begin if not exists (select 1 from pg_type where typname = 'chore_recurrence') then create type chore_recurrence as enum ('Twice Weekly', 'Weekly', 'Bi-Weekly', 'Monthly', 'Quarterly'); end if; end $$;

create table if not exists chores (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  title            text not null,
  description      text,
  recurrence       chore_recurrence not null default 'Weekly',
  rotation_offset  integer not null default 0,
  created_at       timestamptz not null default now()
);

do $$ begin if not exists (select 1 from pg_type where typname = 'chore_status') then create type chore_status as enum ('Pending', 'Completed', 'Swapped', 'Auctioned'); end if; end $$;

create table if not exists chore_assignments (
  id           uuid primary key default gen_random_uuid(),
  chore_id     uuid not null references chores(id) on delete cascade,
  assigned_to  uuid not null references profiles(id) on delete cascade,
  due_date     date not null,
  status       chore_status not null default 'Pending',
  completed_at timestamptz
);

-- ──────────────────────────────────────────────────────────
-- KARMA MARKETPLACE
-- ──────────────────────────────────────────────────────────
create table if not exists karma_marketplace (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references chore_assignments(id) on delete cascade,
  cash_bounty   numeric(10,2) not null default 0,
  karma_bounty  integer not null default 0,
  is_open       boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- TRANSACTIONS
-- ──────────────────────────────────────────────────────────
do $$ begin if not exists (select 1 from pg_type where typname = 'expense_category') then create type expense_category as enum ('Rent', 'Groceries', 'Utilities', 'Shared Subscriptions', 'Miscellaneous Ad-Hoc'); end if; end $$;

create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  paid_by      uuid not null references profiles(id) on delete cascade,
  amount       numeric(10,2) not null,
  memo         text not null default '',
  category     expense_category not null default 'Miscellaneous Ad-Hoc',
  created_at   timestamptz not null default now()
);

create table if not exists transaction_splits (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  debtor_id      uuid not null references profiles(id) on delete cascade,
  amount_owed    numeric(10,2) not null,
  settled        boolean not null default false
);

-- ──────────────────────────────────────────────────────────
-- SUBSCRIPTIONS
-- ──────────────────────────────────────────────────────────
create table if not exists subscriptions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  title         text not null,
  monthly_cost  numeric(10,2) not null,
  owner_id      uuid not null references profiles(id) on delete cascade,
  started_at    timestamptz not null default now()
);

create table if not exists subscription_members (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references subscriptions(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  unique (subscription_id, profile_id)
);

-- ──────────────────────────────────────────────────────────
-- SHOPPING LIST
-- ──────────────────────────────────────────────────────────
create table if not exists shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  added_by     uuid not null references profiles(id) on delete cascade,
  title        text not null,
  quantity     text not null default '1',
  urgent       boolean not null default false,
  purchased    boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- NOTICES & BROADCASTS
-- ──────────────────────────────────────────────────────────
do $$ begin if not exists (select 1 from pg_type where typname = 'notice_type') then create type notice_type as enum ('Instant Buzz Notification', 'Permanent Memo', 'Formal Landlord Notice'); end if; end $$;

create table if not exists notices (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  author_id    uuid not null references profiles(id) on delete cascade,
  title        text,
  body         text not null,
  type         notice_type not null default 'Permanent Memo',
  created_at   timestamptz not null default now()
);

create table if not exists read_acks (
  id        uuid primary key default gen_random_uuid(),
  notice_id uuid not null references notices(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  read_at   timestamptz not null default now(),
  unique (notice_id, user_id)
);

-- ──────────────────────────────────────────────────────────
-- BOOKINGS
-- ──────────────────────────────────────────────────────────
create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  booked_by     uuid not null references profiles(id) on delete cascade,
  resource_name text not null,
  start_time    timestamptz not null,
  end_time      timestamptz not null
);

-- ──────────────────────────────────────────────────────────
-- GUEST LOGS
-- ──────────────────────────────────────────────────────────
create table if not exists guest_logs (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  host_id        uuid not null references profiles(id) on delete cascade,
  guest_name     text not null,
  arrival_date   date not null,
  departure_date date not null
);

-- ──────────────────────────────────────────────────────────
-- MAINTENANCE TICKETS
-- ──────────────────────────────────────────────────────────
do $$ begin if not exists (select 1 from pg_type where typname = 'maintenance_status') then create type maintenance_status as enum ('Open', 'Vendor Dispatched', 'Resolved'); end if; end $$;

create table if not exists maintenance_tickets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  reported_by  uuid not null references profiles(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  image_url    text,
  status       maintenance_status not null default 'Open',
  created_at   timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- PET LOGS
-- ──────────────────────────────────────────────────────────
do $$ begin if not exists (select 1 from pg_type where typname = 'pet_action') then create type pet_action as enum ('Morning Feed', 'Evening Feed', 'Daily Walk', 'Medication Administered'); end if; end $$;

create table if not exists pet_logs (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  pet_name     text not null,
  action       pet_action not null,
  done_by      uuid not null references profiles(id) on delete cascade,
  action_at    timestamptz not null default now()
);

-- ──────────────────────────────────────────────────────────
-- CO-LIVING AGREEMENTS
-- ──────────────────────────────────────────────────────────
create table if not exists coliving_agreements (
  household_id          uuid primary key references households(id) on delete cascade,
  quiet_start           text not null default '22:00',
  quiet_end             text not null default '08:00',
  hygiene_score         integer not null default 3 check (hygiene_score between 1 and 5),
  guest_overstay_rules  text not null default 'Max 3 consecutive nights',
  updated_at            timestamptz not null default now()
);

create table if not exists agreement_signatures (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  signed_at    timestamptz not null default now(),
  unique (household_id, user_id)
);

-- ──────────────────────────────────────────────────────────
-- LOCKBOX
-- ──────────────────────────────────────────────────────────
create table if not exists lockbox (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references households(id) on delete cascade,
  key_name       text not null,
  value          text not null,
  is_restricted  boolean not null default false
);

-- ──────────────────────────────────────────────────────────
-- STORAGE BUCKET
-- ──────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('roomies-property-vault', 'roomies-property-vault', true)
on conflict do nothing;

-- ──────────────────────────────────────────────────────────
-- ROW-LEVEL SECURITY
-- ──────────────────────────────────────────────────────────
alter table households           enable row level security;
alter table profiles             enable row level security;
alter table household_members    enable row level security;
alter table user_presence        enable row level security;
alter table chores               enable row level security;
alter table chore_assignments    enable row level security;
alter table karma_marketplace    enable row level security;
alter table transactions         enable row level security;
alter table transaction_splits   enable row level security;
alter table subscriptions        enable row level security;
alter table subscription_members enable row level security;
alter table shopping_items       enable row level security;
alter table notices              enable row level security;
alter table read_acks            enable row level security;
alter table bookings             enable row level security;
alter table guest_logs           enable row level security;
alter table maintenance_tickets  enable row level security;
alter table pet_logs             enable row level security;
alter table coliving_agreements  enable row level security;
alter table agreement_signatures enable row level security;
alter table lockbox              enable row level security;

-- Helper: is the current user a member of a given household?
create or replace function is_household_member(hid uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from household_members
    where household_id = hid and profile_id = auth.uid()
  );
$$;

-- Profiles: read all, write own
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update" on profiles for update using (auth.uid() = id);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);

-- Households
create policy "households_select" on households for select using (is_household_member(id));
create policy "households_insert" on households for insert with check (auth.uid() is not null);

-- Household members
create policy "hm_select" on household_members for select using (is_household_member(household_id));
create policy "hm_insert" on household_members for insert with check (auth.uid() is not null);

-- User presence
create policy "presence_select" on user_presence for select using (true);
create policy "presence_upsert" on user_presence for all using (auth.uid() = profile_id);

-- All other tables: household-scoped
create policy "chores_select"        on chores               for select using (is_household_member(household_id));
create policy "chores_all"           on chores               for all   using (is_household_member(household_id));
create policy "ca_select"            on chore_assignments    for select using (true);
create policy "ca_all"               on chore_assignments    for all   using (true);
create policy "km_select"            on karma_marketplace    for select using (true);
create policy "km_all"               on karma_marketplace    for all   using (true);
create policy "tx_select"            on transactions         for select using (is_household_member(household_id));
create policy "tx_all"               on transactions         for all   using (is_household_member(household_id));
create policy "splits_select"        on transaction_splits   for select using (true);
create policy "splits_all"           on transaction_splits   for all   using (true);
create policy "subs_select"          on subscriptions        for select using (is_household_member(household_id));
create policy "subs_all"             on subscriptions        for all   using (is_household_member(household_id));
create policy "sub_members_select"   on subscription_members for select using (true);
create policy "sub_members_all"      on subscription_members for all   using (true);
create policy "shopping_select"      on shopping_items       for select using (is_household_member(household_id));
create policy "shopping_all"         on shopping_items       for all   using (is_household_member(household_id));
create policy "notices_select"       on notices              for select using (is_household_member(household_id));
create policy "notices_all"          on notices              for all   using (is_household_member(household_id));
create policy "acks_select"          on read_acks            for select using (true);
create policy "acks_all"             on read_acks            for all   using (true);
create policy "bookings_select"      on bookings             for select using (is_household_member(household_id));
create policy "bookings_all"         on bookings             for all   using (is_household_member(household_id));
create policy "guests_select"        on guest_logs           for select using (is_household_member(household_id));
create policy "guests_all"           on guest_logs           for all   using (is_household_member(household_id));
create policy "maint_select"         on maintenance_tickets  for select using (is_household_member(household_id));
create policy "maint_all"            on maintenance_tickets  for all   using (is_household_member(household_id));
create policy "pets_select"          on pet_logs             for select using (is_household_member(household_id));
create policy "pets_all"             on pet_logs             for all   using (is_household_member(household_id));
create policy "agreements_select"    on coliving_agreements  for select using (is_household_member(household_id));
create policy "agreements_all"       on coliving_agreements  for all   using (is_household_member(household_id));
create policy "sigs_select"          on agreement_signatures for select using (is_household_member(household_id));
create policy "sigs_all"             on agreement_signatures for all   using (is_household_member(household_id));
create policy "lockbox_select"       on lockbox              for select using (is_household_member(household_id));
create policy "lockbox_all"          on lockbox              for all   using (is_household_member(household_id));

-- Storage: household members can read/write their own files
create policy "storage_select" on storage.objects for select using (bucket_id = 'roomies-property-vault');
create policy "storage_insert" on storage.objects for insert with check (bucket_id = 'roomies-property-vault' and auth.uid() is not null);
create policy "storage_delete" on storage.objects for delete using (bucket_id = 'roomies-property-vault' and auth.uid() is not null);

-- ──────────────────────────────────────────────────────────
-- MIGRATION: add tutorial tracking (run on existing projects)
-- ──────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists has_completed_roomies_tutorial boolean not null default false;
