-- ============================================================
-- Migration 005 — Household Inventory + Venmo Username
-- Run in Supabase SQL Editor
-- ============================================================

-- Add venmo_username column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS venmo_username text;

-- Household non-food inventory items
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

-- RLS
ALTER TABLE public.household_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_inventory_select" ON public.household_inventory
  FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "household_inventory_insert" ON public.household_inventory
  FOR INSERT WITH CHECK (is_household_member(household_id) AND auth.uid() = added_by);

CREATE POLICY "household_inventory_delete" ON public.household_inventory
  FOR DELETE USING (auth.uid() = added_by);
