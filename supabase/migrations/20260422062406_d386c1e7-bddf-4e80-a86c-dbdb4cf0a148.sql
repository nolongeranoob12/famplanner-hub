ALTER TABLE public.activities ADD COLUMN pinned_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX idx_activities_pinned_at ON public.activities(pinned_at DESC NULLS LAST);

DROP POLICY IF EXISTS "Authors can update their activities" ON public.activities;

CREATE POLICY "Authors can update their activities"
ON public.activities
FOR UPDATE
TO authenticated
USING ((user_id = auth.uid()) AND (family_id = get_my_family_id()))
WITH CHECK ((user_id = auth.uid()) AND (family_id = get_my_family_id()));

CREATE POLICY "Family members can pin activities"
ON public.activities
FOR UPDATE
TO authenticated
USING (family_id = get_my_family_id())
WITH CHECK (family_id = get_my_family_id());