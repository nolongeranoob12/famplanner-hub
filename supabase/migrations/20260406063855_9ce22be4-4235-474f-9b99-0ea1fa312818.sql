
CREATE OR REPLACE TRIGGER on_activity_change
AFTER INSERT OR UPDATE OR DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.notify_activity_change();
