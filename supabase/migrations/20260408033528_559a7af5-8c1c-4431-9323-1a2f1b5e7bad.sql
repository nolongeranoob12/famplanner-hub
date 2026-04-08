
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS avatar_emoji text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view member avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'member-avatars');
CREATE POLICY "Anyone can upload member avatars" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'member-avatars');
CREATE POLICY "Anyone can update member avatars" ON storage.objects FOR UPDATE TO public USING (bucket_id = 'member-avatars');
CREATE POLICY "Anyone can delete member avatars" ON storage.objects FOR DELETE TO public USING (bucket_id = 'member-avatars');
