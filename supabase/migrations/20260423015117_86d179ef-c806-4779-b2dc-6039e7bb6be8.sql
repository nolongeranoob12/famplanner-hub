CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _family_id uuid;
  _is_owner boolean;
  _other_owners int;
  _other_members int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  SELECT family_id INTO _family_id FROM public.profiles WHERE id = _uid;

  IF _family_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _uid AND family_id = _family_id AND role = 'owner'
    ) INTO _is_owner;

    IF _is_owner THEN
      SELECT count(*) INTO _other_owners FROM public.user_roles
        WHERE family_id = _family_id AND role = 'owner' AND user_id <> _uid;
      SELECT count(*) INTO _other_members FROM public.profiles
        WHERE family_id = _family_id AND id <> _uid;

      IF _other_owners = 0 AND _other_members > 0 THEN
        RAISE EXCEPTION 'You are the only owner of a family with other members. Transfer ownership or remove the other members before deleting your account.';
      END IF;
    END IF;
  END IF;

  -- Clean up user-owned rows that don't cascade
  DELETE FROM public.push_subscriptions WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;

  -- Finally, remove the auth user (cascades to anything else referencing auth.users)
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;