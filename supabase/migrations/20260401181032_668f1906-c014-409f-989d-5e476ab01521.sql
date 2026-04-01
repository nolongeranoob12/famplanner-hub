
-- Activity log table
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
  member_name text NOT NULL,
  action text NOT NULL, -- 'created', 'updated', 'deleted'
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view activity_log" ON public.activity_log FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert activity_log" ON public.activity_log FOR INSERT TO public WITH CHECK (true);

-- Notifications table (one per member per log entry)
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid REFERENCES public.activity_log(id) ON DELETE CASCADE NOT NULL,
  member_name text NOT NULL, -- the recipient
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view notifications" ON public.notifications FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert notifications" ON public.notifications FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update notifications" ON public.notifications FOR UPDATE TO public USING (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: when an activity is inserted, updated, or deleted, create a log entry and fan-out notifications to all OTHER family members
CREATE OR REPLACE FUNCTION public.notify_activity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
  _member text;
  _desc text;
  _activity_id uuid;
  _log_id uuid;
  _family_member text;
  _family_members text[] := ARRAY['Dad','Mom','Jitsoon','Jityi','Jitbao','Ruimin'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _member := NEW.member_name;
    _desc := NEW.description;
    _activity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _member := NEW.member_name;
    _desc := NEW.description;
    _activity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _member := OLD.member_name;
    _desc := OLD.description;
    _activity_id := OLD.id;
  END IF;

  -- Insert activity log
  INSERT INTO public.activity_log (activity_id, member_name, action, description)
  VALUES (_activity_id, _member, _action, _desc)
  RETURNING id INTO _log_id;

  -- Fan out notifications to all other family members
  FOREACH _family_member IN ARRAY _family_members
  LOOP
    IF _family_member <> _member THEN
      INSERT INTO public.notifications (log_id, member_name)
      VALUES (_log_id, _family_member);
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to activities table
CREATE TRIGGER on_activity_change
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.notify_activity_change();
