
CREATE TABLE public.member_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_name text NOT NULL UNIQUE,
  phone text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view member profiles" ON public.member_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert member profiles" ON public.member_profiles FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update member profiles" ON public.member_profiles FOR UPDATE TO public USING (true);
