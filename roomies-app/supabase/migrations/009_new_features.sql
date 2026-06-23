-- ============================================================
-- HomeBase – Session 31: New Features Migration
-- recurring bills, chore swaps, packages, calendar, seasonal tasks,
-- move-in checklist, lease info, emergency contacts, incident reports
-- ============================================================

-- Recurring bills (auto-split on a schedule)
create table if not exists recurring_bills (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references households(id) on delete cascade,
  created_by        uuid not null references profiles(id) on delete cascade,
  title             text not null,
  amount            numeric(10,2) not null,
  category          expense_category not null default 'Miscellaneous Ad-Hoc',
  recurrence        text not null default 'Monthly',
  day_of_month      integer,
  split_equally     boolean not null default true,
  is_active         boolean not null default true,
  last_generated_at timestamptz,
  created_at        timestamptz not null default now()
);

alter table recurring_bills enable row level security;
create policy "rb_select" on recurring_bills for select using (is_household_member(household_id));
create policy "rb_all"    on recurring_bills for all   using (is_household_member(household_id));

-- Chore swap requests
create table if not exists chore_swap_requests (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references households(id) on delete cascade,
  requester_id            uuid not null references profiles(id) on delete cascade,
  requestee_id            uuid not null references profiles(id) on delete cascade,
  requester_assignment_id uuid not null references chore_assignments(id) on delete cascade,
  requestee_assignment_id uuid references chore_assignments(id) on delete cascade,
  status                  text not null default 'Pending',
  message                 text,
  created_at              timestamptz not null default now()
);

alter table chore_swap_requests enable row level security;
create policy "csr_select" on chore_swap_requests for select using (is_household_member(household_id));
create policy "csr_all"    on chore_swap_requests for all   using (is_household_member(household_id));

-- Package tracker
create table if not exists packages (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references households(id) on delete cascade,
  logged_by       uuid not null references profiles(id) on delete cascade,
  description     text not null,
  carrier         text,
  tracking_number text,
  expected_date   date,
  status          text not null default 'Expected',
  arrived_at      timestamptz,
  picked_up_by    uuid references profiles(id),
  created_at      timestamptz not null default now()
);

alter table packages enable row level security;
create policy "pkg_select" on packages for select using (is_household_member(household_id));
create policy "pkg_all"    on packages for all   using (is_household_member(household_id));

-- House events (calendar)
create table if not exists house_events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references profiles(id) on delete cascade,
  title        text not null,
  description  text,
  event_date   date not null,
  event_time   text,
  created_at   timestamptz not null default now()
);

alter table house_events enable row level security;
create policy "he_select" on house_events for select using (is_household_member(household_id));
create policy "he_all"    on house_events for all   using (is_household_member(household_id));

-- Seasonal / one-off tasks (anyone can claim, earns karma)
create table if not exists seasonal_tasks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  created_by   uuid not null references profiles(id) on delete cascade,
  title        text not null,
  description  text,
  karma_reward integer not null default 15,
  claimed_by   uuid references profiles(id),
  completed    boolean not null default false,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

alter table seasonal_tasks enable row level security;
create policy "st_select" on seasonal_tasks for select using (is_household_member(household_id));
create policy "st_all"    on seasonal_tasks for all   using (is_household_member(household_id));

-- Move-in checklist rooms
create table if not exists move_in_rooms (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  room_name    text not null,
  created_by   uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table move_in_rooms enable row level security;
create policy "mir_select" on move_in_rooms for select using (is_household_member(household_id));
create policy "mir_all"    on move_in_rooms for all   using (is_household_member(household_id));

-- Move-in checklist items per room
create table if not exists move_in_items (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references move_in_rooms(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  item_name    text not null,
  condition    text not null default 'Good',
  notes        text,
  photo_url    text,
  logged_by    uuid not null references profiles(id) on delete cascade,
  logged_at    timestamptz not null default now()
);

alter table move_in_items enable row level security;
create policy "mii_select" on move_in_items for select using (is_household_member(household_id));
create policy "mii_all"    on move_in_items for all   using (is_household_member(household_id));

-- Lease info (per household)
create table if not exists lease_info (
  household_id  uuid primary key references households(id) on delete cascade,
  lease_start   date,
  lease_end     date,
  monthly_rent  numeric(10,2),
  updated_by    uuid references profiles(id),
  updated_at    timestamptz not null default now()
);

alter table lease_info enable row level security;
create policy "li_select" on lease_info for select using (is_household_member(household_id));
create policy "li_all"    on lease_info for all   using (is_household_member(household_id));

-- Emergency contacts (per member per household)
create table if not exists emergency_contacts (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  profile_id   uuid not null references profiles(id) on delete cascade,
  contact_name text not null,
  relationship text not null default 'Family',
  phone        text not null,
  email        text,
  created_at   timestamptz not null default now()
);

alter table emergency_contacts enable row level security;
create policy "ec_select" on emergency_contacts for select using (is_household_member(household_id));
create policy "ec_all"    on emergency_contacts for all   using (is_household_member(household_id));

-- Incident reports (safety/property incidents)
create table if not exists incident_reports (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  reported_by  uuid not null references profiles(id) on delete cascade,
  title        text not null,
  description  text not null default '',
  severity     text not null default 'Low',
  photo_url    text,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table incident_reports enable row level security;
create policy "ir_select" on incident_reports for select using (is_household_member(household_id));
create policy "ir_all"    on incident_reports for all   using (is_household_member(household_id));
