import { createClient } from '@/lib/supabase/server';
import { SubmitClipForm } from '@/components/clipper/submit-form';
import { Campaign } from '@/lib/types';

export default async function SubmitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get clipper's active campaigns
  const { data: campaignClippers } = await supabase
    .from('campaign_clippers')
    .select(`
      campaign:campaigns(*)
    `)
    .eq('clipper_id', user.id);

  const allCampaigns = (campaignClippers
    ?.map((cc) => cc.campaign)
    .flat()
    .filter(Boolean) || []) as unknown as Campaign[];
  
  const campaigns = allCampaigns.filter((c) => c?.status === 'active');

  // Get today's submissions to check limits
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySubmissions } = await supabase
    .from('submissions')
    .select('campaign_id')
    .eq('clipper_id', user.id)
    .gte('submitted_at', `${today}T00:00:00`)
    .lt('submitted_at', `${today}T23:59:59`);

  const submittedCampaignIds = todaySubmissions?.map((s) => s.campaign_id) || [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submit Clip</h1>
        <p className="text-gray-600">Submit your X (Twitter) clip for a campaign</p>
      </div>

      <SubmitClipForm
        campaigns={campaigns as { id: string; name: string; description: string | null }[]}
        submittedCampaignIds={submittedCampaignIds}
        userId={user.id}
      />
    </div>
  );
}
