-- Fix handle_new_user trigger to never abort the auth.users INSERT.
-- The original trigger (001_init.sql) had no exception handler, so any
-- username conflict or DB error rolled back the signup → 500 "Database error
-- saving new user". The client-side fetchProfile already creates the profile
-- row on the first SIGNED_IN event if the trigger was skipped.

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  base_name text;
  final_name text;
  n         int := 0;
begin
  begin
    base_name := coalesce(
      new.raw_user_meta_data->>'username',
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, new.id::text), '@', 1)
    );
    -- Strip non-alphanumeric/underscore chars so we always get a valid username
    base_name := regexp_replace(base_name, '[^a-zA-Z0-9_]', '', 'g');
    if base_name = '' then base_name := substring(new.id::text, 1, 8); end if;
    final_name := base_name;
    -- Deduplicate: append incrementing suffix if username already taken
    while exists (select 1 from public.profiles where username = final_name) loop
      n := n + 1;
      final_name := base_name || n;
    end loop;
    insert into public.profiles (id, username)
    values (new.id, final_name)
    on conflict (id) do nothing;
  exception when others then
    null; -- swallow all errors; client creates the profile row on SIGNED_IN
  end;
  return new;
end;
$$;

-- Re-bind the trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
