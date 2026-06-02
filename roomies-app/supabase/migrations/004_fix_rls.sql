-- ============================================================
-- MIGRATION 004: Fix RLS INSERT blocking + allow custom pet chores
-- Run this in Supabase SQL Editor to resolve:
--   1. "new row violates row-level security policy" on all table inserts
--   2. Custom pet chores failing to save (enum type too restrictive)
-- ============================================================

-- ── Fix 1: is_household_member() with explicit search_path ───
-- Without SET search_path the function may not resolve household_members
-- correctly when called from an INSERT policy check context.
CREATE OR REPLACE FUNCTION public.is_household_member(hid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = hid AND profile_id = auth.uid()
  );
$$;

-- ── Fix 2: Recreate all household-scoped INSERT policies ──────
-- FOR ALL USING (expr) should apply USING as WITH CHECK for INSERT
-- but explicit WITH CHECK is required for reliable behaviour on all
-- Supabase / PostgreSQL versions.

-- Lockbox
DROP POLICY IF EXISTS "lb: members manage"  ON public.lockbox;
DROP POLICY IF EXISTS "lockbox_select"       ON public.lockbox;
DROP POLICY IF EXISTS "lockbox_all"          ON public.lockbox;
CREATE POLICY "lb: members select" ON public.lockbox FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "lb: members insert" ON public.lockbox FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "lb: members update" ON public.lockbox FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "lb: members delete" ON public.lockbox FOR DELETE USING     (is_household_member(household_id));

-- Transactions
DROP POLICY IF EXISTS "tx: members manage"  ON public.transactions;
DROP POLICY IF EXISTS "tx_select"            ON public.transactions;
DROP POLICY IF EXISTS "tx_all"               ON public.transactions;
CREATE POLICY "tx: members select" ON public.transactions FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "tx: members insert" ON public.transactions FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "tx: members update" ON public.transactions FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "tx: members delete" ON public.transactions FOR DELETE USING     (is_household_member(household_id));

-- Notices
DROP POLICY IF EXISTS "n: members manage"   ON public.notices;
DROP POLICY IF EXISTS "notices_select"       ON public.notices;
DROP POLICY IF EXISTS "notices_all"          ON public.notices;
CREATE POLICY "n: members select" ON public.notices FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "n: members insert" ON public.notices FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "n: members update" ON public.notices FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "n: members delete" ON public.notices FOR DELETE USING     (is_household_member(household_id));

-- Pet logs
DROP POLICY IF EXISTS "pl: members manage"  ON public.pet_logs;
DROP POLICY IF EXISTS "pets_select"          ON public.pet_logs;
DROP POLICY IF EXISTS "pets_all"             ON public.pet_logs;
CREATE POLICY "pl: members select" ON public.pet_logs FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "pl: members insert" ON public.pet_logs FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "pl: members update" ON public.pet_logs FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "pl: members delete" ON public.pet_logs FOR DELETE USING     (is_household_member(household_id));

-- Shopping items
DROP POLICY IF EXISTS "si: members manage"  ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_select"      ON public.shopping_items;
DROP POLICY IF EXISTS "shopping_all"         ON public.shopping_items;
CREATE POLICY "si: members select" ON public.shopping_items FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "si: members insert" ON public.shopping_items FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "si: members update" ON public.shopping_items FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "si: members delete" ON public.shopping_items FOR DELETE USING     (is_household_member(household_id));

-- Chores
DROP POLICY IF EXISTS "ch2: members manage" ON public.chores;
DROP POLICY IF EXISTS "chores_select"        ON public.chores;
DROP POLICY IF EXISTS "chores_all"           ON public.chores;
CREATE POLICY "ch2: members select" ON public.chores FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "ch2: members insert" ON public.chores FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "ch2: members update" ON public.chores FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "ch2: members delete" ON public.chores FOR DELETE USING     (is_household_member(household_id));

-- Bookings
DROP POLICY IF EXISTS "bk: members manage"  ON public.bookings;
DROP POLICY IF EXISTS "bookings_select"      ON public.bookings;
DROP POLICY IF EXISTS "bookings_all"         ON public.bookings;
CREATE POLICY "bk: members select" ON public.bookings FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "bk: members insert" ON public.bookings FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "bk: members update" ON public.bookings FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "bk: members delete" ON public.bookings FOR DELETE USING     (is_household_member(household_id));

-- Guest logs
DROP POLICY IF EXISTS "gl: members manage"  ON public.guest_logs;
DROP POLICY IF EXISTS "guests_select"        ON public.guest_logs;
DROP POLICY IF EXISTS "guests_all"           ON public.guest_logs;
CREATE POLICY "gl: members select" ON public.guest_logs FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "gl: members insert" ON public.guest_logs FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "gl: members update" ON public.guest_logs FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "gl: members delete" ON public.guest_logs FOR DELETE USING     (is_household_member(household_id));

-- Maintenance tickets
DROP POLICY IF EXISTS "mt: members manage"  ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maint_select"         ON public.maintenance_tickets;
DROP POLICY IF EXISTS "maint_all"            ON public.maintenance_tickets;
CREATE POLICY "mt: members select" ON public.maintenance_tickets FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "mt: members insert" ON public.maintenance_tickets FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "mt: members update" ON public.maintenance_tickets FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "mt: members delete" ON public.maintenance_tickets FOR DELETE USING     (is_household_member(household_id));

-- Coliving agreements
DROP POLICY IF EXISTS "ca2: members manage" ON public.coliving_agreements;
DROP POLICY IF EXISTS "agreements_select"    ON public.coliving_agreements;
DROP POLICY IF EXISTS "agreements_all"       ON public.coliving_agreements;
CREATE POLICY "ca2: members select" ON public.coliving_agreements FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "ca2: members insert" ON public.coliving_agreements FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "ca2: members update" ON public.coliving_agreements FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "ca2: members delete" ON public.coliving_agreements FOR DELETE USING     (is_household_member(household_id));

-- Agreement signatures
DROP POLICY IF EXISTS "sig: members manage" ON public.agreement_signatures;
DROP POLICY IF EXISTS "sigs_select"          ON public.agreement_signatures;
DROP POLICY IF EXISTS "sigs_all"             ON public.agreement_signatures;
CREATE POLICY "sig: members select" ON public.agreement_signatures FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "sig: members insert" ON public.agreement_signatures FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "sig: members update" ON public.agreement_signatures FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "sig: members delete" ON public.agreement_signatures FOR DELETE USING     (is_household_member(household_id));

-- Subscriptions
DROP POLICY IF EXISTS "subs: members manage" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_select"           ON public.subscriptions;
DROP POLICY IF EXISTS "subs_all"              ON public.subscriptions;
CREATE POLICY "subs: members select" ON public.subscriptions FOR SELECT USING     (is_household_member(household_id));
CREATE POLICY "subs: members insert" ON public.subscriptions FOR INSERT WITH CHECK (is_household_member(household_id));
CREATE POLICY "subs: members update" ON public.subscriptions FOR UPDATE USING     (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "subs: members delete" ON public.subscriptions FOR DELETE USING     (is_household_member(household_id));

-- ── Fix 3: Change pet_logs.action from enum to text ──────────
-- The pet_action enum only accepts the 4 standard values, blocking
-- custom chore names. Changing to text allows any string.
ALTER TABLE public.pet_logs ALTER COLUMN action TYPE text;
DROP TYPE IF EXISTS public.pet_action CASCADE;

-- ── Fix 4: Ensure households.created_by exists ────────────────
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS created_by uuid
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── Fix 5: Household delete/update policies ───────────────────
DROP POLICY IF EXISTS "hh: creator can delete" ON public.households;
DROP POLICY IF EXISTS "hh: creator can update" ON public.households;
CREATE POLICY "hh: creator can delete"
  ON public.households FOR DELETE
  USING (created_by = auth.uid());
CREATE POLICY "hh: creator can update"
  ON public.households FOR UPDATE
  USING (created_by = auth.uid());
