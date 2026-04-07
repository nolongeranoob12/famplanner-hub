CREATE OR REPLACE FUNCTION public.notify_activity_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _action text;
  _member text;
  _desc text;
  _activity_id uuid;
  _log_id uuid;
  _family_member text;
  _family_members text[] := ARRAY['Dad','Mom','Jitsoon','Jityi','Jitbao','Ruimin'];
  _title text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
    _member := NEW.member_name;
    _desc := NEW.description;
    _activity_id := NEW.id;
    _title := _member || ' posted an activity';
  ELSIF TG_OP = 'UPDATE' THEN
    _action := 'updated';
    _member := NEW.member_name;
    _desc := NEW.description;
    _activity_id := NEW.id;
    _title := _member || ' edited an activity';
  ELSIF TG_OP = 'DELETE' THEN
    _action := 'deleted';
    _member := OLD.member_name;
    _desc := OLD.description;
    _activity_id := OLD.id;
    _title := _member || ' removed an activity';
  END IF;

  INSERT INTO public.activity_log (activity_id, member_name, action, description)
  VALUES (_activity_id, _member, _action, _desc)
  RETURNING id INTO _log_id;

  FOREACH _family_member IN ARRAY _family_members
  LOOP
    IF _family_member <> _member THEN
      INSERT INTO public.notifications (log_id, member_name)
      VALUES (_log_id, _family_member);
    END IF;
  END LOOP;

  PERFORM net.http_post(
    url := 'https://huzmazeiruntkcyrwxcq.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'title', _title,
      'body', COALESCE(_desc, 'Check the family board!'),
      'exclude_member', _member
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1em1hemVpcnVudGtjeXJ3eGNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ0ODgxNiwiZXhwIjoyMDkwMDI0ODE2fQ._oGU3fHfaL32gF_sfgT7BkXkeA4qMeBUCdubAJQOHZQ'
    )
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;