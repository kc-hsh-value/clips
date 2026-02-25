-- Add Instagram platform support to campaign_platforms_v2
-- Run in Supabase SQL editor before creating Instagram-enabled campaign platforms

DO $$
DECLARE
  platform_data_type text;
  platform_udt_name text;
BEGIN
  SELECT data_type, udt_name
  INTO platform_data_type, platform_udt_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'campaign_platforms_v2'
    AND column_name = 'platform';

  -- If this is a PostgreSQL enum, add value to enum type.
  IF platform_data_type = 'USER-DEFINED' THEN
    BEGIN
      EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', platform_udt_name, 'instagram');
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END $$;

-- If platform is TEXT with a CHECK constraint, refresh it to include instagram.
ALTER TABLE campaign_platforms_v2
  DROP CONSTRAINT IF EXISTS campaign_platforms_v2_platform_check;

ALTER TABLE campaign_platforms_v2
  ADD CONSTRAINT campaign_platforms_v2_platform_check
  CHECK (platform IN ('x', 'youtube', 'tiktok', 'instagram'));
