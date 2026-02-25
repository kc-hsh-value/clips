-- Allow multiple submissions per day per campaign platform/clipper.
-- Keep protection against duplicate post submission within the same day.

-- 1) Drop legacy one-per-day unique constraint if present.
ALTER TABLE submissions_v2
  DROP CONSTRAINT IF EXISTS submissions_v2_campaign_platform_id_clipper_id_submitted_da_key;

-- 2) Also remove old unique indexes if they were created directly.
DROP INDEX IF EXISTS submissions_v2_campaign_platform_id_clipper_id_submitted_day_key;
DROP INDEX IF EXISTS submissions_v2_campaign_platform_id_clipper_id_submitted_da_key;

-- 3) Ensure submitted_day is available for uniqueness scope.
ALTER TABLE submissions_v2
  ADD COLUMN IF NOT EXISTS submitted_day DATE;

UPDATE submissions_v2
SET submitted_day = COALESCE(submitted_day, (submitted_at AT TIME ZONE 'UTC')::date)
WHERE submitted_day IS NULL;

-- 4) Prevent exact duplicate post per day for the same clipper+platform.
-- This still allows N different posts/day according to configured limits.
CREATE UNIQUE INDEX IF NOT EXISTS submissions_v2_unique_post_per_day
  ON submissions_v2(campaign_platform_id, clipper_id, submitted_day, external_id)
  WHERE external_id IS NOT NULL;
