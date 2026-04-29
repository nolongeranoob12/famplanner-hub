CREATE OR REPLACE FUNCTION public.notify_activity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF _family_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT COALESCE(display_name, 'Someone') INTO _actor_name
  FROM public.profiles WHERE id = _user_id;

  _title := COALESCE(_actor_name, 'Someone') || ' ' ||
    CASE _action
      WHEN 'created' THEN 'posted an activity'
      WHEN 'updated' THEN 'edited an activity'
      WHEN 'deleted' THEN 'removed an activity'
    END;

  INSERT INTO public.activity_log (activity_id, member_name, action, description, family_id, user_id)
  VALUES (_activity_id, COALESCE(_actor_name, 'Someone'), _action, _desc, _family_id, _user_id)
  RETURNING id INTO _log_id;

  INSERT INTO public.notifications (log_id, member_name, family_id, user_id)
  SELECT _log_id, COALESCE(p.display_name, ''), _family_id, p.id
  FROM public.profiles p
  WHERE p.family_id = _family_id AND p.id <> _user_id;

  PERFORM net.http_post(
    url := 'https://huzmazeiruntkcyrwxcq.supabase.co/functions/v1/send-push',
    body := jsonb_build_object(
      'title', _title,
      'body', COALESCE(_desc, 'Check the family board!'),
      'family_id', _family_id,
      'exclude_user_id', _user_id,
      'platform', 'ios'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1em1hemVpcnVudGtjeXJ3eGNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDg4MTYsImV4cCI6MjA5MDAyNDgxNn0.DT5UzZU3-haDqGbDdE8okexbImAEBxX7tKbbJ3OalwI'
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;