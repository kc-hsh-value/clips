import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatViews, formatCurrency, calculatePayout } from '@/lib/payout';

type Platform = 'x' | 'youtube' | 'tiktok' | 'instagram';

interface PlatformTotals {
  paid: number;
  pending: number;
  processed: number;
  potential: number;
  views: number;
  submissions: number;
}

interface PayoutRow {
  id: string;
  campaign_id: string;
  total_views: number;
  final_amount: number;
  multiplier: number;
  status: 'pending' | 'processed' | 'paid';
  campaign?: { name?: string | null } | { name?: string | null }[];
}

interface PayoutBreakdownRow {
  payout_id: string;
  campaign_platform_id: string;
  total_views: number;
  final_amount: number;
}

interface PlatformConfigRow {
  id: string;
  platform: Platform;
}

interface SubmissionRow {
  id: string;
  views: number;
  campaign?: { name?: string | null; status?: string | null } | { name?: string | null; status?: string | null }[];
  campaign_platform?: {
    platform?: Platform;
    rate_per_1k?: number;
    multiplier_100k?: number;
    multiplier_250k?: number;
    max_payout_per_video?: number | null;
  } | {
    platform?: Platform;
    rate_per_1k?: number;
    multiplier_100k?: number;
    multiplier_250k?: number;
    max_payout_per_video?: number | null;
  }[];
}

function getSingle<T>(relation: T | T[] | null | undefined): T | undefined {
  if (!relation) return undefined;
  return Array.isArray(relation) ? relation[0] : relation;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get clipper's payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select(`
      *,
      campaign:campaigns(name, rate_per_1k, multiplier_100k, multiplier_250k)
    `)
    .eq('clipper_id', user.id)
    .order('created_at', { ascending: false });

  const payoutRows = (payouts || []) as PayoutRow[];

  const payoutIds = payoutRows.map((payout) => payout.id);

  const { data: payoutBreakdowns } = payoutIds.length
    ? await supabase
        .from('payout_breakdowns')
        .select('payout_id, campaign_platform_id, total_views, final_amount')
        .in('payout_id', payoutIds)
    : { data: [] as PayoutBreakdownRow[] };

  const breakdownRows = (payoutBreakdowns || []) as PayoutBreakdownRow[];

  const campaignPlatformIds = [...new Set(breakdownRows.map((row) => row.campaign_platform_id))];

  const { data: platformConfigs } = campaignPlatformIds.length
    ? await supabase
        .from('campaign_platforms_v2')
        .select('id, platform')
        .in('id', campaignPlatformIds)
    : { data: [] as PlatformConfigRow[] };

  const platformConfigRows = (platformConfigs || []) as PlatformConfigRow[];
  const platformByConfigId = new Map(platformConfigRows.map((row) => [row.id, row.platform]));

  // Get approved submissions for potential earnings
  const { data: submissions } = await supabase
    .from('submissions_v2')
    .select(`
      id,
      views,
      campaign:campaigns_v2!submissions_v2_campaign_id_fkey(name, status),
      campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(
        platform,
        rate_per_1k,
        multiplier_100k,
        multiplier_250k,
        max_payout_per_video
      )
    `)
    .eq('clipper_id', user.id)
    .eq('status', 'approved');

  const submissionRows = (submissions || []) as SubmissionRow[];

  // Calculate totals
  const totalPaid = payoutRows
    ?.filter((p) => p.status === 'paid')
    .reduce((acc, p) => acc + (p.final_amount || 0), 0) || 0;

  const totalPending = payoutRows
    ?.filter((p) => p.status === 'pending')
    .reduce((acc, p) => acc + (p.final_amount || 0), 0) || 0;

  const totalProcessed = payoutRows
    ?.filter((p) => p.status === 'processed')
    .reduce((acc, p) => acc + (p.final_amount || 0), 0) || 0;

  // Calculate potential earnings from active campaigns
  const activeSubmissions = submissionRows.filter(
    (submission) => getSingle(submission.campaign)?.status === 'active'
  );
  
  let potentialEarnings = 0;

  const platformTotals: Record<Platform, PlatformTotals> = {
    x: { paid: 0, pending: 0, processed: 0, potential: 0, views: 0, submissions: 0 },
    youtube: { paid: 0, pending: 0, processed: 0, potential: 0, views: 0, submissions: 0 },
    tiktok: { paid: 0, pending: 0, processed: 0, potential: 0, views: 0, submissions: 0 },
    instagram: { paid: 0, pending: 0, processed: 0, potential: 0, views: 0, submissions: 0 },
  };

  for (const breakdown of breakdownRows) {
    const platform = platformByConfigId.get(breakdown.campaign_platform_id);
    if (!platform) continue;

    const payout = payoutRows.find((row) => row.id === breakdown.payout_id);
    if (!payout) continue;

    if (payout.status === 'paid') platformTotals[platform].paid += breakdown.final_amount || 0;
    if (payout.status === 'pending') platformTotals[platform].pending += breakdown.final_amount || 0;
    if (payout.status === 'processed') platformTotals[platform].processed += breakdown.final_amount || 0;

    platformTotals[platform].views += breakdown.total_views || 0;
  }

  activeSubmissions.forEach((s) => {
    const campaignPlatform = getSingle(s.campaign_platform);
    if (campaignPlatform) {
      const payout = calculatePayout(
        s.views,
        campaignPlatform.rate_per_1k,
        campaignPlatform.multiplier_100k,
        campaignPlatform.multiplier_250k,
        campaignPlatform.max_payout_per_video
      );
      potentialEarnings += payout.cappedAmount;

      const platform = campaignPlatform.platform;
      if (platform) {
        platformTotals[platform].potential += payout.cappedAmount;
        platformTotals[platform].views += s.views || 0;
        platformTotals[platform].submissions += 1;
      }
    }
  });

  const totalEarned = totalPaid + totalPending + totalProcessed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-gray-600">Track your earnings and payouts</p>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Total Paid</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {formatCurrency(totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Pending Payout</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">
              {formatCurrency(totalPending)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Processed Payout</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">
              {formatCurrency(totalProcessed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Potential (Active)</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {formatCurrency(potentialEarnings)}
            </p>
            <p className="text-xs text-gray-500 mt-1">From active campaigns</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Earnings Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">Total Earned (all payout states)</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalEarned)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">Total Payout Views</p>
              <p className="text-2xl font-bold mt-1">
                {formatViews(
                  Object.values(platformTotals).reduce((acc, totals) => acc + totals.views, 0)
                )}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">Active Potential Submissions</p>
              <p className="text-2xl font-bold mt-1">
                {Object.values(platformTotals).reduce((acc, totals) => acc + totals.submissions, 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platform Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {(['x', 'youtube', 'tiktok', 'instagram'] as Platform[]).map((platform) => (
              <div key={platform} className="rounded-lg border p-4 space-y-2">
                <p className="font-semibold uppercase">{PLATFORM_LABELS[platform]}</p>
                <p className="text-sm text-gray-600">Paid: {formatCurrency(platformTotals[platform].paid)}</p>
                <p className="text-sm text-gray-600">Pending: {formatCurrency(platformTotals[platform].pending)}</p>
                <p className="text-sm text-gray-600">Processed: {formatCurrency(platformTotals[platform].processed)}</p>
                <p className="text-sm text-blue-700">Potential: {formatCurrency(platformTotals[platform].potential)}</p>
                <p className="text-sm text-gray-600">Views: {formatViews(platformTotals[platform].views)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts && payouts.length > 0 ? (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{getSingle(payout.campaign)?.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatViews(payout.total_views)} views × {payout.multiplier}x
                    </p>
                    {((breakdownRows.filter((row) => row.payout_id === payout.id)) || []).length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        {breakdownRows
                          .filter((row) => row.payout_id === payout.id)
                          .map((row) => {
                            const platform = platformByConfigId.get(row.campaign_platform_id);
                            if (!platform) return null;
                            return (
                              <Badge key={`${payout.id}-${row.campaign_platform_id}`} variant="outline" className="uppercase text-xs">
                                {platform}: {formatCurrency(row.final_amount)}
                              </Badge>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(payout.final_amount)}</p>
                    <Badge
                      variant={
                        payout.status === 'paid'
                          ? 'default'
                          : payout.status === 'processed'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {payout.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No payouts yet</p>
          )}
        </CardContent>
      </Card>

      {/* Active Earnings Breakdown */}
      {activeSubmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Campaign Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeSubmissions.map((submission) => {
                const campaign = getSingle(submission.campaign);
                const campaignPlatform = getSingle(submission.campaign_platform);

                const payout = campaignPlatform
                  ? calculatePayout(
                      submission.views,
                      campaignPlatform.rate_per_1k,
                      campaignPlatform.multiplier_100k,
                      campaignPlatform.multiplier_250k,
                      campaignPlatform.max_payout_per_video
                    )
                  : null;

                return (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{campaign?.name}</p>
                      <p className="text-sm text-gray-500">
                        {campaignPlatform?.platform?.toUpperCase()} •{' '}
                        {formatViews(submission.views)} views
                        {payout && payout.multiplier > 1 && (
                          <span className="text-green-600 ml-2">
                            × {payout.multiplier}x bonus!
                          </span>
                        )}
                        {payout && payout.wasCapped && (
                          <span className="text-orange-600 ml-2">
                            (capped)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {payout ? formatCurrency(payout.finalAmount) : '-'}
                      </p>
                      <p className="text-xs text-gray-500">Potential</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Info */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>• Base rate: $4 per 1,000 views</p>
          <p>• 100K+ views: 1.25x multiplier</p>
          <p>• 250K+ views: 1.5x multiplier</p>
          <p>• Payouts are calculated at the end of each campaign</p>
        </CardContent>
      </Card>
    </div>
  );
}
