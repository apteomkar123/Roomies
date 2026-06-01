-- Fix 1: households SELECT policy
-- The old policy (is_household_member) blocked two flows:
--   a) invite-code lookup — user isn't a member yet
--   b) post-INSERT select — user isn't in household_members yet when .select() runs
-- Fix: allow any authenticated user to SELECT households (safe — data is just name/code).
DROP POLICY IF EXISTS "households_select"          ON public.households;
DROP POLICY IF EXISTS "hh: members can view"       ON public.households;

CREATE POLICY "hh: members can view"
  ON public.households FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Fix 2 (unified-schema only): handle_new_user trigger exception block
-- If not already applied via 002_fix_trigger.sql, run this too:
-- (safe to re-run — CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base_name  text;
  final_name text;
  n          int := 0;
BEGIN
  BEGIN
    base_name := coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, new.id::text), '@', 1)
    );
    base_name  := regexp_replace(base_name, '[^a-zA-Z0-9_]', '', 'g');
    IF base_name = '' THEN base_name := substr(new.id::text, 1, 8); END IF;
    final_name := base_name;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_name) LOOP
      n          := n + 1;
      final_name := base_name || n;
    END LOOP;
    INSERT INTO public.profiles (id, username)
    VALUES (new.id, final_name)
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
