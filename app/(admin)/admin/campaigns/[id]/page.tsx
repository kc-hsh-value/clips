import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { formatViews, formatCurrency } from '@/lib/payout';
import { CampaignClippersManager } from '@/components/admin/campaign-clippers-manager';
import { CampaignSubmissions } from '@/components/admin/campaign-submissions';
import { RefreshViewsButton } from '@/components/admin/refresh-views-button';
import { ClipperLeaderboard } from '@/components/admin/clipper-leaderboard';
import { EndCampaignButton } from '@/components/admin/end-campaign-button';

interface PlatformConfig {
  id: string;
  platform: 'x' | 'youtube' | 'tiktok';
  rate_per_1k: number;
  multiplier_100k: number;
  multiplier_250k: number;
  max_payout_per_video: number | null;
  is_enabled: boolean;
}

function getPlatformValue(
  relation:
    | { platform?: string | null }
    | Array<{ platform?: string | null }>
    | null
    | undefined
) {
  if (Array.isArray(relation)) return relation[0]?.platform || undefined;
  return relation?.platform || undefined;
}

interface CampaignPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (!campaign) {
    notFound();
  }

  const { data: campaignV2 } = await supabase
    .from('campaigns_v2')
    .select('*')
    .eq('legacy_campaign_id', id)
    .single();

  const activePlatformConfigs: PlatformConfig[] = campaignV2
    ? (
        (
          await supabase
            .from('campaign_platforms_v2')
            .select('*')
            .eq('campaign_id', campaignV2.id)
            .eq('is_enabled', true)
        ).data || []
      )
    : [];

  // Fetch creator info separately (created_by might not exist yet)
  let creator: { full_name: string | null; email: string } | null = null;
  if (campaign.created_by) {
    const { data: creatorData } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', campaign.created_by)
      .single();
    creator = creatorData;
  }

  // Get campaign stats
  const { data: submissions } = campaignV2
    ? await supabase
        .from('submissions_v2')
        .select('views, status, campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform)')
        .eq('campaign_id', campaignV2.id)
    : { data: [] as { views: number; status: string; campaign_platform?: { platform?: string } | { platform?: string }[] }[] };

  const { count: clipperCount } = campaignV2
    ? await supabase
        .from('campaign_clippers_v2')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignV2.id)
    : { count: 0 };

  const totalViews = submissions?.reduce((acc, s) => acc + (s.views || 0), 0) || 0;
  const approvedSubmissions = submissions?.filter((s) => s.status === 'approved').length || 0;
  const platformViews = (submissions || []).reduce(
    (acc, submission) => {
      const platform = getPlatformValue(submission.campaign_platform);
      if (platform === 'x') acc.x += submission.views || 0;
      if (platform === 'youtube') acc.youtube += submission.views || 0;
      if (platform === 'tiktok') acc.tiktok += submission.views || 0;
      return acc;
    },
    { x: 0, youtube: 0, tiktok: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <Badge
              variant={
                campaign.status === 'active'
                  ? 'default'
                  : campaign.status === 'completed'
                  ? 'secondary'
                  : 'outline'
              }
            >
              {campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-gray-600 mt-1">{campaign.description}</p>
          )}
          {creator && (
            <p className="text-sm text-gray-500 mt-1">
              Created by {creator.full_name || creator.email}
            </p>
          )}
        </div>
        {campaign.status === 'active' && (
          <EndCampaignButton campaignId={campaign.id} campaignName={campaign.name} />
        )}
        {/* <DeleteCampaignButton
          campaignId={campaign.id}
          campaignName={campaign.name}
          submissionCount={submissions?.length || 0}
        /> */}
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">
                  {format(new Date(campaign.start_date), 'MMM d')} -{' '}
                  {format(new Date(campaign.end_date), 'MMM d')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Clippers</p>
                <p className="font-medium">{clipperCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="font-medium">{formatViews(totalViews)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  X {formatViews(platformViews.x)} • YT {formatViews(platformViews.youtube)} • TT {formatViews(platformViews.tiktok)}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <RefreshViewsButton campaignId={id} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-gray-600">Submissions</p>
              <p className="font-medium">
                {approvedSubmissions} approved / {submissions?.length || 0} total
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Settings</CardTitle>
        </CardHeader>
        <CardContent>
          {activePlatformConfigs.length > 0 ? (
            <div className="space-y-4">
              {activePlatformConfigs.map((config) => (
                <div key={config.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold uppercase">{config.platform}</p>
                    <Badge variant="outline">Enabled</Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-gray-600">Rate per 1K views</p>
                      <p className="text-lg font-semibold">{formatCurrency(config.rate_per_1k)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">100K+ Multiplier</p>
                      <p className="text-lg font-semibold">{config.multiplier_100k}x</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">250K+ Multiplier</p>
                      <p className="text-lg font-semibold">{config.multiplier_250k}x</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Max Payout Per Video</p>
                      <p className="text-lg font-semibold">
                        {config.max_payout_per_video
                          ? formatCurrency(config.max_payout_per_video)
                          : 'No cap'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No platform settings found</p>
          )}
        </CardContent>
      </Card>

      {/* Clipper Leaderboard */}
      <ClipperLeaderboard 
        campaignId={campaignV2?.id || ''}
        platformConfigs={activePlatformConfigs.map((config) => ({
          platform: config.platform,
          ratePerK: config.rate_per_1k,
          multiplier100k: config.multiplier_100k,
          multiplier250k: config.multiplier_250k,
          maxPayoutPerVideo: config.max_payout_per_video,
        }))}
      />

      {/* Clippers Management */}
      <CampaignClippersManager campaignId={campaignV2?.id || ''} />

      {/* Submissions */}
      <CampaignSubmissions campaignId={campaignV2?.id || ''} />
    </div>
  );
}
