
-- Re-attach the trigger to the activities table
CREATE OR REPLACE TRIGGER activity_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_activity_change();
