DROP TRIGGER IF EXISTS activity_notify_trigger ON public.activities;
DROP TRIGGER IF EXISTS on_activity_change ON public.activities;
DROP TRIGGER IF EXISTS stamp_activities_family_and_user ON public.activities;

DROP TRIGGER IF EXISTS notify_activity_change_trigger ON public.activities;
CREATE TRIGGER notify_activity_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.notify_activity_change();