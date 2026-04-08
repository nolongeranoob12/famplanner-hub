
CREATE TABLE public.activity_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, member_name, emoji)
);

ALTER TABLE public.activity_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions" ON public.activity_reactions FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert reactions" ON public.activity_reactions FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can delete reactions" ON public.activity_reactions FOR DELETE TO public USING (true);
