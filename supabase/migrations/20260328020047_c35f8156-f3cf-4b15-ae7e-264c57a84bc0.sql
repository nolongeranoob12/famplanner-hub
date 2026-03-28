ALTER TABLE public.activities RENAME COLUMN activity_time TO time_start;
ALTER TABLE public.activities ADD COLUMN time_end text;