-- ============================================================
-- MIGRATION 007 — Fix cross-app RLS for household_inventory
--                 and shopping_list
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Fix 1: household_inventory RLS ───────────────────────────
-- Recreate with explicit patterns that match the fixed 004 style
DROP POLICY IF EXISTS "household_inventory_select" ON public.household_inventory;
DROP POLICY IF EXISTS "household_inventory_insert" ON public.household_inventory;
DROP POLICY IF EXISTS "household_inventory_delete" ON public.household_inventory;

CREATE POLICY "hi: members select" ON public.household_inventory
  FOR SELECT USING (is_household_member(household_id));
CREATE POLICY "hi: members insert" ON public.household_inventory
  FOR INSERT WITH CHECK (is_household_member(household_id) AND auth.uid() = added_by);
CREATE POLICY "hi: members update" ON public.household_inventory
  FOR UPDATE USING (is_household_member(household_id)) WITH CHECK (is_household_member(household_id));
CREATE POLICY "hi: members delete" ON public.household_inventory
  FOR DELETE USING (auth.uid() = added_by OR is_household_member(household_id));

-- ── Fix 2: shopping_list — allow HomeBase writes via household_members ────
-- The existing policy only allows inserts for the user's active_household_id.
-- HomeBase writes with household_id from household_members, which may differ.
DROP POLICY IF EXISTS "household members can manage shared list" ON public.shopping_list;

CREATE POLICY "household members can manage shared list"
  ON public.shopping_list FOR ALL
  USING (
    household_id IN (
      SELECT active_household_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    household_id IN (
      SELECT household_id FROM public.household_members WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (
      household_id IN (
        SELECT active_household_id FROM public.profiles WHERE id = auth.uid()
      )
      OR
      household_id IN (
        SELECT household_id FROM public.household_members WHERE profile_id = auth.uid()
      )
    )
  );

-- ── Fix 3: Sync active_household_id when joining via household_members ────
-- When a user joins a household (insert into household_members), set their
-- active_household_id in profiles if not already set.
CREATE OR REPLACE FUNCTION public.sync_active_household()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET active_household_id = NEW.household_id
  WHERE id = NEW.profile_id
    AND active_household_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_household_member_added ON public.household_members;
CREATE TRIGGER on_household_member_added
  AFTER INSERT ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_active_household();

-- Back-fill active_household_id for users already in household_members
UPDATE public.profiles p
SET active_household_id = hm.household_id
FROM public.household_members hm
WHERE hm.profile_id = p.id
  AND p.active_household_id IS NULL;

-- ── Fix 4: fridge_inventory — allow household member inserts from HomeBase ──
-- The existing policy only allows insert when user_id = auth.uid().
-- This is already satisfied (HomeBase passes user.id), so no policy change
-- needed here. But we do need to allow household members to VIEW shared items
-- whose household_id matches their membership (not just active_household_id).
DROP POLICY IF EXISTS "household members can view shared items" ON public.fridge_inventory;

CREATE POLICY "household members can view shared items"
  ON public.fridge_inventory FOR SELECT
  USING (
    is_household = true
    AND (
      household_id IN (
        SELECT active_household_id FROM public.profiles WHERE id = auth.uid()
      )
      OR
      household_id IN (
        SELECT household_id FROM public.household_members WHERE profile_id = auth.uid()
      )
    )
  );
