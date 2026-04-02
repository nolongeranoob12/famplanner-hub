
-- Enable pg_net extension for HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Update the notify_activity_change function to also call send-push edge function
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
  _supabase_url text;
  _service_role_key text;
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

  -- Call send-push edge function via pg_net
  SELECT current_setting('app.settings.supabase_url', true) INTO _supabase_url;
  SELECT current_setting('app.settings.service_role_key', true) INTO _service_role_key;

  -- Fallback to vault secrets if app settings not available
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  END IF;
  IF _service_role_key IS NULL OR _service_role_key = '' THEN
    SELECT decrypted_secret INTO _service_role_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;
  END IF;

  IF _supabase_url IS NOT NULL AND _service_role_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _supabase_url || '/functions/v1/send-push',
      body := jsonb_build_object(
        'title', _title,
        'body', COALESCE(_desc, 'Check the family board!'),
        'exclude_member', _member
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_role_key
      )
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;
