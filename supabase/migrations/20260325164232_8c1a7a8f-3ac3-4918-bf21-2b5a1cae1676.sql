-- Create activities table
CREATE TABLE public.activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dinner', 'sports', 'errands', 'travel', 'movie', 'hangout', 'other')),
  description TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Everyone can read activities (family board is shared)
CREATE POLICY "Anyone can view activities" ON public.activities FOR SELECT USING (true);

-- Anyone can insert activities
CREATE POLICY "Anyone can insert activities" ON public.activities FOR INSERT WITH CHECK (true);

-- Anyone can delete activities
CREATE POLICY "Anyone can delete activities" ON public.activities FOR DELETE USING (true);

-- Anyone can update activities
CREATE POLICY "Anyone can update activities" ON public.activities FOR UPDATE USING (true);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();