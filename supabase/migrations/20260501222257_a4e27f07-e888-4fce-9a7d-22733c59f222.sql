-- Merge any duplicate native rows before restoring one-row-per-device-token behavior.
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.device_token IS NOT NULL
  AND a.device_token = b.device_token
  AND a.created_at < b.created_at;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_device_token_user_id_key;

ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_device_token_key;

DROP INDEX IF EXISTS public.push_subscriptions_device_token_unique;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_device_token_key UNIQUE (device_token);

CREATE OR REPLACE FUNCTION public.register_native_push_subscription(
  _device_token text,
  _family_id uuid,
  _member_name text,
  _platform text DEFAULT 'ios',
  _bundle_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  )
  ON CONFLICT (device_token)
  DO UPDATE SET
    user_id = EXCLUDED.user_id,
    family_id = EXCLUDED.family_id,
    member_name = EXCLUDED.member_name,
    endpoint = EXCLUDED.endpoint,
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    platform = EXCLUDED.platform,
    bundle_id = EXCLUDED.bundle_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_native_push_subscription(text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_native_push_subscription(text, uuid, text, text, text) TO authenticated;