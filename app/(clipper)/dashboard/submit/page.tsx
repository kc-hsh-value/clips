import { createClient } from '@/lib/supabase/server';
import { SubmitClipForm } from '@/components/clipper/submit-form';

interface CampaignPlatformOption {
  id: string;
  platform: 'x' | 'youtube' | 'tiktok';
  is_enabled: boolean;
  rate_per_1k: number;
}

interface CampaignOption {
  id: string;
  name: string;
  description: string | null;
  status: string;
  platforms: CampaignPlatformOption[];
}

export default async function SubmitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get clipper's active campaigns
  const { data: campaignClippers } = await supabase
    .from('campaign_clippers_v2')
    .select(`
      campaign:campaigns_v2(
        id,
        name,
        description,
        status,
        platforms:campaign_platforms_v2(id, platform, is_enabled, rate_per_1k)
      )
    `)
    .eq('clipper_id', user.id);

  const allCampaigns = (campaignClippers
    ?.map((cc) => (Array.isArray(cc.campaign) ? cc.campaign[0] : cc.campaign))
    .filter(Boolean) || []) as unknown as CampaignOption[];

  const campaigns = allCampaigns
    .filter((campaign) => campaign?.status === 'active')
    .map((campaign) => ({
      ...campaign,
      platforms: (campaign.platforms || []).filter((platform) => platform.is_enabled),
    }));

  // Get today's submissions to check limits
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySubmissions } = await supabase
    .from('submissions_v2')
    .select('campaign_platform_id')
    .eq('clipper_id', user.id)
    .gte('submitted_at', `${today}T00:00:00`)
    .lt('submitted_at', `${today}T23:59:59`);

  const submittedCampaignPlatformIds = todaySubmissions?.map((s) => s.campaign_platform_id) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit Clip</h1>
        <p className="text-gray-600">Submit your clip for a campaign platform</p>
      </div>

      <SubmitClipForm
        campaigns={campaigns as { id: string; name: string; description: string | null; platforms: CampaignPlatformOption[] }[]}
        submittedCampaignPlatformIds={submittedCampaignPlatformIds}
      />
    </div>
  );
}
