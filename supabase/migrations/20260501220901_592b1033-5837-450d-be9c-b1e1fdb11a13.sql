-- Drop the old single-column unique constraint/index on device_token
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_device_token_key;

DROP INDEX IF EXISTS public.push_subscriptions_device_token_unique;

-- Remove duplicates on (device_token, user_id) before adding composite unique
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.device_token IS NOT NULL
  AND a.device_token = b.device_token
  AND a.user_id IS NOT DISTINCT FROM b.user_id
  AND a.created_at < b.created_at;

-- Add composite unique constraint on (device_token, user_id)
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_device_token_user_id_key
  UNIQUE (device_token, user_id);