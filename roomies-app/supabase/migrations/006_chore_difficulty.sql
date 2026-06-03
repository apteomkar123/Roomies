-- Migration 006: Add difficulty column to chores table
-- Enables intensity-based workload balancing across household members.
-- Values: 1=Easy, 2=Light (default), 3=Medium, 4=Hard, 5=Intense
ALTER TABLE public.chores
  ADD COLUMN IF NOT EXISTS difficulty integer NOT NULL DEFAULT 2;
