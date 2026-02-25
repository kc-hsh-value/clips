-- Campaign platform per-clipper daily limits (v2)
-- Run this in Supabase SQL editor

-- 1) Default limit per campaign platform
ALTER TABLE campaign_platforms_v2
ADD COLUMN IF NOT EXISTS daily_submission_limit INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_platforms_v2_daily_submission_limit_check'
  ) THEN
    ALTER TABLE campaign_platforms_v2
      ADD CONSTRAINT campaign_platforms_v2_daily_submission_limit_check
      CHECK (daily_submission_limit >= 0);
  END IF;
END $$;

-- 2) Per-clipper overrides per campaign platform
CREATE TABLE IF NOT EXISTS campaign_platform_clipper_limits_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_platform_id UUID NOT NULL REFERENCES campaign_platforms_v2(id) ON DELETE CASCADE,
  clipper_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  daily_submission_limit INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_platform_id, clipper_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_platform_clipper_limits_v2_daily_submission_limit_check'
  ) THEN
    ALTER TABLE campaign_platform_clipper_limits_v2
      ADD CONSTRAINT campaign_platform_clipper_limits_v2_daily_submission_limit_check
      CHECK (daily_submission_limit >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cpcl_v2_campaign_platform ON campaign_platform_clipper_limits_v2(campaign_platform_id);
CREATE INDEX IF NOT EXISTS idx_cpcl_v2_clipper ON campaign_platform_clipper_limits_v2(clipper_id);

-- 3) updated_at trigger
DROP TRIGGER IF EXISTS update_campaign_platform_clipper_limits_v2_updated_at ON campaign_platform_clipper_limits_v2;
CREATE TRIGGER update_campaign_platform_clipper_limits_v2_updated_at
  BEFORE UPDATE ON campaign_platform_clipper_limits_v2
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4) Backfill existing assignments
INSERT INTO campaign_platform_clipper_limits_v2 (campaign_platform_id, clipper_id, daily_submission_limit)
SELECT
  cp.id,
  cc.clipper_id,
  cp.daily_submission_limit
FROM campaign_clippers_v2 cc
JOIN campaign_platforms_v2 cp ON cp.campaign_id = cc.campaign_id
ON CONFLICT (campaign_platform_id, clipper_id) DO NOTHING;

-- 5) Auto-seed when assigning a clipper to a campaign
CREATE OR REPLACE FUNCTION seed_limits_for_campaign_clipper_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO campaign_platform_clipper_limits_v2 (campaign_platform_id, clipper_id, daily_submission_limit)
  SELECT
    cp.id,
    NEW.clipper_id,
    cp.daily_submission_limit
  FROM campaign_platforms_v2 cp
  WHERE cp.campaign_id = NEW.campaign_id
  ON CONFLICT (campaign_platform_id, clipper_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_campaign_clipper_v2_insert_seed_limits ON campaign_clippers_v2;
CREATE TRIGGER on_campaign_clipper_v2_insert_seed_limits
  AFTER INSERT ON campaign_clippers_v2
  FOR EACH ROW EXECUTE FUNCTION seed_limits_for_campaign_clipper_v2();

-- 6) Auto-seed when creating a new campaign platform
CREATE OR REPLACE FUNCTION seed_limits_for_campaign_platform_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO campaign_platform_clipper_limits_v2 (campaign_platform_id, clipper_id, daily_submission_limit)
  SELECT
    NEW.id,
    cc.clipper_id,
    NEW.daily_submission_limit
  FROM campaign_clippers_v2 cc
  WHERE cc.campaign_id = NEW.campaign_id
  ON CONFLICT (campaign_platform_id, clipper_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_campaign_platform_v2_insert_seed_limits ON campaign_platforms_v2;
CREATE TRIGGER on_campaign_platform_v2_insert_seed_limits
  AFTER INSERT ON campaign_platforms_v2
  FOR EACH ROW EXECUTE FUNCTION seed_limits_for_campaign_platform_v2();

-- 7) Keep RLS strict and explicit
ALTER TABLE campaign_platform_clipper_limits_v2 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clippers can view own platform limits" ON campaign_platform_clipper_limits_v2;
CREATE POLICY "Clippers can view own platform limits" ON campaign_platform_clipper_limits_v2
  FOR SELECT USING (clipper_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage platform limits" ON campaign_platform_clipper_limits_v2;
CREATE POLICY "Admins can manage platform limits" ON campaign_platform_clipper_limits_v2
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
