DROP POLICY IF EXISTS "Family members can pin activities" ON public.activities;

CREATE POLICY "Family members can pin activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (family_id = get_my_family_id())
WITH CHECK (family_id = get_my_family_id());

CREATE OR REPLACE FUNCTION public.restrict_non_author_activity_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.type IS DISTINCT FROM OLD.type
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.activity_date IS DISTINCT FROM OLD.activity_date
     OR NEW.time_start IS DISTINCT FROM OLD.time_start
     OR NEW.time_end IS DISTINCT FROM OLD.time_end
     OR NEW.image_url IS DISTINCT FROM OLD.image_url
     OR NEW.member_name IS DISTINCT FROM OLD.member_name
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.family_id IS DISTINCT FROM OLD.family_id
  THEN
    RAISE EXCEPTION 'Only the author can edit this activity';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS restrict_non_author_activity_updates ON public.activities;
CREATE TRIGGER restrict_non_author_activity_updates
BEFORE UPDATE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.restrict_non_author_activity_updates();