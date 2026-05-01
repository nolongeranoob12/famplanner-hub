CREATE OR REPLACE FUNCTION public.register_native_push_subscription(
  _device_token text,
  _family_id uuid,
  _member_name text,
  _platform text DEFAULT 'ios'::text,
  _bundle_id text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF _device_token IS NULL OR length(trim(_device_token)) = 0 THEN
    RAISE EXCEPTION 'Device token is required';
  END IF;

  IF _family_id IS DISTINCT FROM public.get_my_family_id() THEN
    RAISE EXCEPTION 'Family does not match signed-in user';
  END IF;

  -- Remove any existing row for this device (could belong to a previous user
  -- on the same physical device). Done as SECURITY DEFINER so RLS doesn't block.
  DELETE FROM public.push_subscriptions WHERE device_token = _device_token;

  -- Also clear any stale row this user had on a different device token
  DELETE FROM public.push_subscriptions
  WHERE user_id = _uid AND (device_token IS DISTINCT FROM _device_token);

  INSERT INTO public.push_subscriptions (
    user_id,
    family_id,
    member_name,
    endpoint,
    p256dh,
    auth,
    platform,
    device_token,
    bundle_id
  )
  VALUES (
    _uid,
    _family_id,
    COALESCE(NULLIF(trim(_member_name), ''), 'Someone'),
    'apns://' || _device_token,
    'native',
    'native',
    COALESCE(NULLIF(trim(_platform), ''), 'ios'),
    _device_token,
    _bundle_id
  );
END;
$function$;