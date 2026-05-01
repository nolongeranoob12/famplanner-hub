-- Remove duplicate rows for the same endpoint/user pair before adding the composite rule.
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.id > b.id
  AND a.endpoint = b.endpoint
  AND a.user_id IS NOT DISTINCT FROM b.user_id;

-- The native APNs endpoint is derived from the device token, so endpoint alone
-- must not be globally unique across accounts on the same iPhone.
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_key;

DROP INDEX IF EXISTS public.push_subscriptions_endpoint_key;
DROP INDEX IF EXISTS public.push_subscriptions_endpoint_unique;

ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_user_id_key
  UNIQUE (endpoint, user_id);