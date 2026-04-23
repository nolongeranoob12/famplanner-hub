CREATE TRIGGER shopping_items_stamp_family_and_user
BEFORE INSERT ON public.shopping_items
FOR EACH ROW
EXECUTE FUNCTION public.stamp_family_and_user();
