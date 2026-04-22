-- Shopping list items shared across a family
CREATE TABLE public.shopping_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID,
  user_id UUID,
  name TEXT NOT NULL,
  quantity TEXT,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_by UUID,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopping_items_family ON public.shopping_items(family_id);
CREATE INDEX idx_shopping_items_done ON public.shopping_items(family_id, is_done, created_at DESC);

ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- Stamp family_id and user_id automatically (reuse existing function)
CREATE TRIGGER stamp_shopping_items
BEFORE INSERT ON public.shopping_items
FOR EACH ROW EXECUTE FUNCTION public.stamp_family_and_user();

CREATE TRIGGER update_shopping_items_updated_at
BEFORE UPDATE ON public.shopping_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: family members can view, add, tick off, and delete shopping items in their family
CREATE POLICY "Family members can view shopping items"
ON public.shopping_items FOR SELECT TO authenticated
USING (family_id = public.get_my_family_id());

CREATE POLICY "Family members can add shopping items"
ON public.shopping_items FOR INSERT TO authenticated
WITH CHECK (family_id = public.get_my_family_id() OR family_id IS NULL);

CREATE POLICY "Family members can update shopping items"
ON public.shopping_items FOR UPDATE TO authenticated
USING (family_id = public.get_my_family_id())
WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "Family members can delete shopping items"
ON public.shopping_items FOR DELETE TO authenticated
USING (family_id = public.get_my_family_id());

-- Enable realtime
ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;