
-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'member');

-- ============================================================
-- 2. FAMILIES TABLE
-- ============================================================
CREATE TABLE public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_families_invite_code ON public.families(invite_code);

-- ============================================================
-- 3. PROFILES TABLE (replaces member_profiles going forward)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_emoji TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_family_id ON public.profiles(family_id);

-- ============================================================
-- 4. USER_ROLES TABLE (separate per security best practice)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, family_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_family_id ON public.user_roles(family_id);

-- ============================================================
-- 5. SECURITY DEFINER HELPER FUNCTIONS
-- ============================================================

-- Returns the family_id of the current authenticated user
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT family_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Checks if the current user has a specific role in a specific family
CREATE OR REPLACE FUNCTION public.has_family_role(_family_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND family_id = _family_id
      AND role = _role
  );
$$;

-- Generates a unique 6-character alphanumeric invite code (excludes ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, (floor(random() * length(chars))::int) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.families WHERE invite_code = code);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique invite code';
    END IF;
  END LOOP;
  RETURN code;
END;
$$;

-- ============================================================
-- 6. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1), ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 7. UPDATED_AT TRIGGERS
-- ============================================================
CREATE TRIGGER update_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. ADD family_id + user_id TO EXISTING TABLES (nullable for now; backfill next step)
-- ============================================================
ALTER TABLE public.activities
  ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.activity_log
  ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.activity_reactions
  ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.push_subscriptions
  ADD COLUMN family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_activities_family_id ON public.activities(family_id);
CREATE INDEX idx_activity_log_family_id ON public.activity_log(family_id);
CREATE INDEX idx_activity_reactions_family_id ON public.activity_reactions(family_id);
CREATE INDEX idx_notifications_family_id ON public.notifications(family_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_push_subscriptions_family_id ON public.push_subscriptions(family_id);
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- ============================================================
-- 9. AUTO-STAMP family_id + user_id ON INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION public.stamp_family_and_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  IF NEW.family_id IS NULL THEN
    NEW.family_id := public.get_my_family_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER stamp_activities BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.stamp_family_and_user();
CREATE TRIGGER stamp_activity_reactions BEFORE INSERT ON public.activity_reactions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_family_and_user();
CREATE TRIGGER stamp_push_subscriptions BEFORE INSERT ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_family_and_user();

-- ============================================================
-- 10. ENABLE RLS ON ALL NEW TABLES
-- ============================================================
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 11. RLS POLICIES — families
-- ============================================================
CREATE POLICY "Users can view their own family"
  ON public.families FOR SELECT TO authenticated
  USING (id = public.get_my_family_id());

CREATE POLICY "Authenticated users can create families"
  ON public.families FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update their family"
  ON public.families FOR UPDATE TO authenticated
  USING (public.has_family_role(id, 'owner'))
  WITH CHECK (public.has_family_role(id, 'owner'));

-- Public lookup of family by invite code (needed during join flow, returns minimal info via RPC)
-- We'll handle this via a SECURITY DEFINER function instead of a permissive policy.

-- ============================================================
-- 12. RLS POLICIES — profiles
-- ============================================================
CREATE POLICY "Users can view profiles in their family"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (family_id IS NOT NULL AND family_id = public.get_my_family_id())
  );

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 13. RLS POLICIES — user_roles
-- ============================================================
CREATE POLICY "Users can view roles in their family"
  ON public.user_roles FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "Owners can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_family_role(family_id, 'owner'))
  WITH CHECK (public.has_family_role(family_id, 'owner'));

CREATE POLICY "Users can insert own owner role on family creation"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 14. RLS POLICIES — REPLACE PUBLIC POLICIES on existing tables
-- ============================================================

-- activities
DROP POLICY IF EXISTS "Anyone can view activities" ON public.activities;
DROP POLICY IF EXISTS "Anyone can insert activities" ON public.activities;
DROP POLICY IF EXISTS "Anyone can update activities" ON public.activities;
DROP POLICY IF EXISTS "Anyone can delete activities" ON public.activities;

CREATE POLICY "Family members can view activities"
  ON public.activities FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "Family members can insert activities"
  ON public.activities FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id() OR family_id IS NULL);

CREATE POLICY "Authors can update their activities"
  ON public.activities FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND family_id = public.get_my_family_id())
  WITH CHECK (user_id = auth.uid() AND family_id = public.get_my_family_id());

CREATE POLICY "Authors can delete their activities"
  ON public.activities FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND family_id = public.get_my_family_id());

-- activity_log
DROP POLICY IF EXISTS "Anyone can view activity_log" ON public.activity_log;
DROP POLICY IF EXISTS "Anyone can insert activity_log" ON public.activity_log;

CREATE POLICY "Family members can view activity_log"
  ON public.activity_log FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "System can insert activity_log"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- activity_reactions
DROP POLICY IF EXISTS "Anyone can view reactions" ON public.activity_reactions;
DROP POLICY IF EXISTS "Anyone can insert reactions" ON public.activity_reactions;
DROP POLICY IF EXISTS "Anyone can delete reactions" ON public.activity_reactions;

CREATE POLICY "Family members can view reactions"
  ON public.activity_reactions FOR SELECT TO authenticated
  USING (family_id = public.get_my_family_id());

CREATE POLICY "Family members can insert reactions"
  ON public.activity_reactions FOR INSERT TO authenticated
  WITH CHECK (family_id = public.get_my_family_id() OR family_id IS NULL);

CREATE POLICY "Users can delete own reactions"
  ON public.activity_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND family_id = public.get_my_family_id());

-- notifications
DROP POLICY IF EXISTS "Anyone can view notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- push_subscriptions
DROP POLICY IF EXISTS "Anyone can manage push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can view own push subscriptions"
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own push subscriptions"
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update own push subscriptions"
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own push subscriptions"
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- member_profiles (legacy — lock down completely; will be removed after migration)
DROP POLICY IF EXISTS "Anyone can view member profiles" ON public.member_profiles;
DROP POLICY IF EXISTS "Anyone can insert member profiles" ON public.member_profiles;
DROP POLICY IF EXISTS "Anyone can update member profiles" ON public.member_profiles;

CREATE POLICY "No public access to legacy member_profiles"
  ON public.member_profiles FOR SELECT TO authenticated
  USING (false);

-- ============================================================
-- 15. RPC: Join family by invite code (SECURITY DEFINER so users can look up codes without exposing the table)
-- ============================================================
CREATE OR REPLACE FUNCTION public.join_family_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family_id UUID;
  _existing_family UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT family_id INTO _existing_family FROM public.profiles WHERE id = auth.uid();
  IF _existing_family IS NOT NULL THEN
    RAISE EXCEPTION 'You are already in a family';
  END IF;

  SELECT id INTO _family_id FROM public.families WHERE invite_code = upper(trim(_code));
  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  UPDATE public.profiles SET family_id = _family_id WHERE id = auth.uid();
  INSERT INTO public.user_roles (user_id, family_id, role) VALUES (auth.uid(), _family_id, 'member')
    ON CONFLICT DO NOTHING;

  RETURN _family_id;
END;
$$;

-- ============================================================
-- 16. RPC: Create a family (atomic: family + role + profile link)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_family(_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family_id UUID;
  _existing_family UUID;
  _code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT family_id INTO _existing_family FROM public.profiles WHERE id = auth.uid();
  IF _existing_family IS NOT NULL THEN
    RAISE EXCEPTION 'You are already in a family';
  END IF;

  _code := public.generate_invite_code();

  INSERT INTO public.families (name, invite_code, created_by)
  VALUES (trim(_name), _code, auth.uid())
  RETURNING id INTO _family_id;

  INSERT INTO public.user_roles (user_id, family_id, role) VALUES (auth.uid(), _family_id, 'owner');

  UPDATE public.profiles SET family_id = _family_id WHERE id = auth.uid();

  RETURN _family_id;
END;
$$;

-- ============================================================
-- 17. RPC: Regenerate invite code (owner only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(_family_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code TEXT;
BEGIN
  IF NOT public.has_family_role(_family_id, 'owner') THEN
    RAISE EXCEPTION 'Only owners can regenerate the invite code';
  END IF;

  _code := public.generate_invite_code();
  UPDATE public.families SET invite_code = _code WHERE id = _family_id;
  RETURN _code;
END;
$$;

-- ============================================================
-- 18. UPDATE notify_activity_change TRIGGER to be family-aware
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_activity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action TEXT;
  _user_id UUID;
  _family_id UUID;
  _desc TEXT;
  _activity_id UUID;
  _log_id UUID;
  _actor_name TEXT;
  _title TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _user_id := NEW.user_id;
    _family_id := NEW.family_id;
    _desc := NEW.description;
    _activity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _user_id := NEW.user_id;
    _family_id := NEW.family_id;
    _desc := NEW.description;
    _activity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _user_id := OLD.user_id;
    _family_id := OLD.family_id;
    _desc := OLD.description;
    _activity_id := OLD.id;
  END IF;

  -- Skip if no family (legacy/orphaned data)
  IF _family_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT COALESCE(display_name, 'Someone') INTO _actor_name
  FROM public.profiles WHERE id = _user_id;

  _title := _actor_name || ' ' ||
    CASE _action
      WHEN 'created' THEN 'posted an activity'
      WHEN 'updated' THEN 'edited an activity'
      WHEN 'deleted' THEN 'removed an activity'
    END;

  INSERT INTO public.activity_log (activity_id, member_name, action, description, family_id, user_id)
  VALUES (_activity_id, COALESCE(_actor_name, 'Someone'), _action, _desc, _family_id, _user_id)
  RETURNING id INTO _log_id;

  -- Fan out a notification row to every OTHER member of the family
  INSERT INTO public.notifications (log_id, member_name, family_id, user_id)
  SELECT _log_id, COALESCE(p.display_name, ''), _family_id, p.id
  FROM public.profiles p
  WHERE p.family_id = _family_id AND p.id <> _user_id;

  -- Push notification (best-effort)
  PERFORM net.http_post(
    url := 'https://huzmazeiruntkcyrwxcq.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'title', _title,
      'body', COALESCE(_desc, 'Check the family board!'),
      'family_id', _family_id,
      'exclude_user_id', _user_id
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1em1hemVpcnVudGtjeXJ3eGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ0ODgxNiwiZXhwIjoyMDkwMDI0ODE2fQ._oGU3fHfaL32gF_sfgT7BkXkeA4qMeBUCdubAJQOHZQ'
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger (in case it wasn't attached)
DROP TRIGGER IF EXISTS activity_notify_trigger ON public.activities;
CREATE TRIGGER activity_notify_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.notify_activity_change();
