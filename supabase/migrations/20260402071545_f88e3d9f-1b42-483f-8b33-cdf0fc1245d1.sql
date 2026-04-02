
-- Create storage bucket for activity photos
INSERT INTO storage.buckets (id, name, public) VALUES ('activity-photos', 'activity-photos', true);

-- Allow anyone to upload to activity-photos bucket
CREATE POLICY "Anyone can upload activity photos"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'activity-photos');

-- Allow anyone to view activity photos
CREATE POLICY "Anyone can view activity photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'activity-photos');

-- Allow anyone to delete their activity photos
CREATE POLICY "Anyone can delete activity photos"
ON storage.objects FOR DELETE TO public
USING (bucket_id = 'activity-photos');

-- Add image_url column to activities table
ALTER TABLE public.activities ADD COLUMN image_url text;
