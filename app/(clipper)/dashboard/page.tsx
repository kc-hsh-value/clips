import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Eye, DollarSign, FileVideo, TrendingUp } from 'lucide-react';
import { formatViews, formatCurrency, calculatePayout } from '@/lib/payout';
import { format } from 'date-fns';

type Platform = 'x' | 'youtube' | 'tiktok' | 'instagram';

interface CampaignPlatformConfig {
  id: string;
  platform: Platform;
  rate_per_1k: number;
  multiplier_100k: number;
  multiplier_250k: number;
  max_payout_per_video: number | null;
  is_enabled: boolean;
  daily_submission_limit?: number;
}

interface CampaignV2 {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  campaign_platforms: CampaignPlatformConfig[];
}

interface SubmissionV2 {
  id: string;
  campaign_id: string;
  campaign_platform_id?: string;
  views: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_day?: string;
  submitted_at: string;
  campaign?: { name?: string | null } | { name?: string | null }[];
  campaign_platform?: CampaignPlatformConfig | CampaignPlatformConfig[];
}

function getSingle<T>(relation: T | T[] | null | undefined): T | undefined {
  if (!relation) return undefined;
  return Array.isArray(relation) ? relation[0] : relation;
}

export default async function ClipperDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get clipper's campaigns
  const { data: campaignClippers } = await supabase
    .from('campaign_clippers_v2')
    .select(`
      campaign:campaigns_v2(
        id,
        name,
        start_date,
        end_date,
        status,
        campaign_platforms:campaign_platforms_v2(id, platform, rate_per_1k, multiplier_100k, multiplier_250k, max_payout_per_video, is_enabled, daily_submission_limit)
      )
    `)
    .eq('clipper_id', user.id);

  const campaigns = (campaignClippers?.map((cc) => getSingle(cc.campaign)).filter(Boolean) || []) as CampaignV2[];
  const activeCampaigns = campaigns.filter((c) => c?.status === 'active');
  const activePlatformIds = activeCampaigns.flatMap((campaign) =>
    (campaign.campaign_platforms || [])
      .filter((platform) => platform.is_enabled)
      .map((platform) => platform.id)
  );

  const { data: limitRows } = activePlatformIds.length
    ? await supabase
        .from('campaign_platform_clipper_limits_v2')
        .select('campaign_platform_id, daily_submission_limit')
        .eq('clipper_id', user.id)
        .in('campaign_platform_id', activePlatformIds)
    : { data: [] as { campaign_platform_id: string; daily_submission_limit: number }[] };

  const dailyLimitByPlatformId = (limitRows || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.campaign_platform_id] = row.daily_submission_limit;
    return acc;
  }, {});

  // Get clipper's submissions
  const { data: submissions } = await supabase
    .from('submissions_v2')
    .select(`
      id,
      campaign_id,
      campaign_platform_id,
      views,
      status,
      submitted_day,
      submitted_at,
      campaign:campaigns_v2!submissions_v2_campaign_id_fkey(name),
      campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform, rate_per_1k, multiplier_100k, multiplier_250k, max_payout_per_video, is_enabled)
    `)
    .eq('clipper_id', user.id)
    .order('created_at', { ascending: false });

  const submissionRows = (submissions || []) as SubmissionV2[];

  // Calculate stats
  const totalViews = submissionRows.reduce((acc, s) => acc + (s.views || 0), 0);
  const approvedSubmissions = submissionRows.filter((s) => s.status === 'approved');

  const viewsByPlatform = submissionRows.reduce(
    (acc, submission) => {
      const config = getSingle(submission.campaign_platform);
      const platform = config?.platform;
      if (!platform) return acc;
      acc[platform] += submission.views || 0;
      return acc;
    },
    { x: 0, youtube: 0, tiktok: 0, instagram: 0 }
  );

  const earningsByPlatform = approvedSubmissions.reduce(
    (acc, submission) => {
      const config = getSingle(submission.campaign_platform);
      if (!config?.platform) return acc;

      const payout = calculatePayout(
        submission.views || 0,
        config.rate_per_1k,
        config.multiplier_100k,
        config.multiplier_250k,
        config.max_payout_per_video
      );

      acc[config.platform] += payout.cappedAmount;
      return acc;
    },
    { x: 0, youtube: 0, tiktok: 0, instagram: 0 }
  );

  const totalEarnings = earningsByPlatform.x + earningsByPlatform.youtube + earningsByPlatform.tiktok + earningsByPlatform.instagram;

  const stats = [
    {
      title: 'Total Views',
      value: formatViews(totalViews),
      icon: Eye,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      breakdown: `X ${formatViews(viewsByPlatform.x)} • YT ${formatViews(viewsByPlatform.youtube)} • TT ${formatViews(viewsByPlatform.tiktok)} • IG ${formatViews(viewsByPlatform.instagram)}`,
    },
    {
      title: 'Approved Clips',
      value: approvedSubmissions.length,
      icon: FileVideo,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Total Earnings',
      value: formatCurrency(totalEarnings),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      breakdown: `X ${formatCurrency(earningsByPlatform.x)} • YT ${formatCurrency(earningsByPlatform.youtube)} • TT ${formatCurrency(earningsByPlatform.tiktok)} • IG ${formatCurrency(earningsByPlatform.instagram)}`,
    },
    {
      title: 'Active Campaigns',
      value: activeCampaigns.length,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Track your performance and earnings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  {'breakdown' in stat && stat.breakdown && (
                    <p className="text-xs text-gray-500 mt-1">{stat.breakdown}</p>
                  )}
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Campaigns</CardTitle>
          <Link href="/dashboard/submit">
            <Button>Submit Clip</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length > 0 ? (
            <div className="space-y-4">
              {activeCampaigns.map((campaign) => {
                // Count submissions for this campaign today
                const today = new Date().toISOString().split('T')[0];
                const todaySubmissions = submissionRows.filter(
                  (s) =>
                    s.campaign_id === campaign?.id &&
                    (s.submitted_day === today || s.submitted_at.split('T')[0] === today)
                );

                const activePlatforms = (campaign.campaign_platforms || [])
                  .filter((platform) => platform.is_enabled)
                  .map((platform) => platform.platform);

                const activePlatformIds = (campaign.campaign_platforms || [])
                  .filter((platform) => platform.is_enabled)
                  .map((platform) => platform.id);

                const submissionCountByPlatformId = todaySubmissions.reduce<Record<string, number>>((acc, row) => {
                  const platformId = row.campaign_platform_id;
                  if (!platformId) return acc;
                  acc[platformId] = (acc[platformId] || 0) + 1;
                  return acc;
                }, {});

                const dailyLimitByCampaignPlatformId = (campaign.campaign_platforms || [])
                  .filter((platform) => platform.is_enabled)
                  .reduce<Record<string, number>>((acc, platform) => {
                    acc[platform.id] = dailyLimitByPlatformId[platform.id] ?? platform.daily_submission_limit ?? 1;
                    return acc;
                  }, {});

                const totalAllowedToday = activePlatformIds.reduce(
                  (acc, platformId) => acc + (dailyLimitByCampaignPlatformId[platformId] || 0),
                  0
                );
                const usedToday = activePlatformIds.reduce(
                  (acc, platformId) => acc + (submissionCountByPlatformId[platformId] || 0),
                  0
                );

                const hasRemainingCapacity = activePlatformIds.some((platformId) => {
                  const allowed = dailyLimitByCampaignPlatformId[platformId] || 0;
                  const used = submissionCountByPlatformId[platformId] || 0;
                  return allowed > 0 && used < allowed;
                });

                const rateSummary = (campaign.campaign_platforms || [])
                  .filter((platform) => platform.is_enabled)
                  .map((platform) => `${platform.platform.toUpperCase()}: ${formatCurrency(platform.rate_per_1k)}/1K`)
                  .join(' • ');

                return (
                  <div
                    key={campaign?.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium">{campaign?.name}</h3>
                      <p className="text-sm text-gray-600">
                        {format(new Date(campaign?.start_date || ''), 'MMM d')} -{' '}
                        {format(new Date(campaign?.end_date || ''), 'MMM d, yyyy')}
                      </p>
                      {rateSummary && <p className="text-sm text-gray-500">{rateSummary}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {activePlatforms.map((platform) => (
                          <Badge key={`${campaign.id}-${platform}`} variant="outline" className="uppercase text-xs">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      {!hasRemainingCapacity ? (
                        <Badge variant="secondary">Submitted today</Badge>
                      ) : (
                        <Link href={`/dashboard/submit?campaign=${campaign?.id}`}>
                          <Button size="sm">Submit Clip</Button>
                        </Link>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {usedToday}/{totalAllowedToday} clips submitted today
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              You&apos;re not assigned to any active campaigns yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissionRows.length > 0 ? (
            <div className="space-y-4">
              {submissionRows.slice(0, 5).map((submission) => {
                const campaign = getSingle(submission.campaign);
                const platform = getSingle(submission.campaign_platform)?.platform;

                return (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{campaign?.name}</p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(submission.submitted_at), 'MMM d, yyyy')} • {platform?.toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatViews(submission.views)} views</p>
                      <Badge
                        variant={
                          submission.status === 'approved'
                            ? 'default'
                            : submission.status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {submission.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No submissions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
