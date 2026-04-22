CREATE OR REPLACE FUNCTION public.remove_family_member(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _family_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated';
  END IF;

  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot remove yourself; use leave family instead';
  END IF;

  SELECT family_id INTO _family_id FROM public.profiles WHERE id = _user_id;
  IF _family_id IS NULL THEN
    RAISE EXCEPTION 'That user is not in a family';
  END IF;

  IF NOT public.has_family_role(_family_id, 'owner') THEN
    RAISE EXCEPTION 'Only the family owner can remove members';
  END IF;

  IF public.has_family_role(_family_id, 'owner') AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND family_id = _family_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot remove another owner';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND family_id = _family_id;
  UPDATE public.profiles SET family_id = NULL WHERE id = _user_id AND family_id = _family_id;
END;
$$;