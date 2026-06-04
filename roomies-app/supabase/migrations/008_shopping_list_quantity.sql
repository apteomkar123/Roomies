-- ============================================================
-- Migration 008 — Add quantity to shopping_list + ensure household_inventory exists
-- Run in Supabase SQL Editor
-- ============================================================

-- Add quantity column to shopping_list (used by both Pantry and HomeBase)
ALTER TABLE public.shopping_list
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1;

-- Ensure household_inventory exists (idempotent re-run of migration 005)
CREATE TABLE IF NOT EXISTS public.household_inventory (
  id            uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id  uuid          NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  added_by      uuid          NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  name          text          NOT NULL,
  category      text          NOT NULL DEFAULT 'Other',
  quantity      numeric       NOT NULL DEFAULT 1,
  unit          text,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.household_inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "household_inventory_select" ON public.household_inventory;
DROP POLICY IF EXISTS "household_inventory_insert" ON public.household_inventory;
DROP POLICY IF EXISTS "household_inventory_delete" ON public.household_inventory;

CREATE POLICY "household_inventory_select" ON public.household_inventory
  FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "household_inventory_insert" ON public.household_inventory
  FOR INSERT WITH CHECK (is_household_member(household_id) AND auth.uid() = added_by);

CREATE POLICY "household_inventory_delete" ON public.household_inventory
  FOR DELETE USING (auth.uid() = added_by);

-- Add to realtime
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.household_inventory; EXCEPTION WHEN others THEN NULL; END;
END $$;
