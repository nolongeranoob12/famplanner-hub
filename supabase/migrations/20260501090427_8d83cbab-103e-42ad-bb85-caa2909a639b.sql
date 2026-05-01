-- Remove duplicate device_token rows, keeping the most recently created one
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.device_token IS NOT NULL
  AND a.device_token = b.device_token
  AND a.created_at < b.created_at;

-- Add unique constraint to support ON CONFLICT (device_token)
ALTER TABLE public.push_subscriptions
ADD CONSTRAINT push_subscriptions_device_token_key UNIQUE (device_token);