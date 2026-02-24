import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatViews } from '@/lib/payout';
import { ExportPayoutsButton } from '@/components/admin/export-payouts-button';
import { GeneratePayoutsButton } from '@/components/admin/generate-payouts-button';
import { PayoutActions } from '@/components/admin/payout-actions';

interface PayoutRow {
  id: string;
  campaign_id: string;
  clipper_id: string;
  total_views: number;
  base_amount: number;
  multiplier: number;
  final_amount: number;
  status: 'pending' | 'processed' | 'paid';
  profile?: { full_name?: string | null; email: string } | { full_name?: string | null; email: string }[];
  campaign?: { name?: string | null } | { name?: string | null }[];
}

interface CampaignV2Row {
  id: string;
  legacy_campaign_id: string;
  name: string;
}

interface CampaignPlatformRow {
  id: string;
  campaign_id: string;
  platform: 'x' | 'youtube' | 'tiktok';
  rate_per_1k: number;
  multiplier_100k: number;
  multiplier_250k: number;
  max_payout_per_video: number | null;
  is_enabled: boolean;
}

interface PayoutBreakdownRow {
  payout_id: string;
  campaign_platform_id: string;
  total_views: number;
  base_amount: number;
  multiplier: number;
  final_amount: number;
}

function getSingle<T>(relation: T | T[] | null | undefined): T | undefined {
  if (!relation) return undefined;
  return Array.isArray(relation) ? relation[0] : relation;
}

export default async function PayoutsPage() {
  const supabase = await createClient();

  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  // Get existing payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select(`
      *,
      profile:profiles(full_name, email),
      campaign:campaigns(name)
    `)
    .order('created_at', { ascending: false });

  const payoutsRows = (payouts || []) as PayoutRow[];

  const legacyCampaignIds = [...new Set(payoutsRows.map((payout) => payout.campaign_id).filter(Boolean))];

  const { data: campaignsV2 } = legacyCampaignIds.length
    ? await supabase
        .from('campaigns_v2')
        .select('id, legacy_campaign_id, name')
        .in('legacy_campaign_id', legacyCampaignIds)
    : { data: [] as CampaignV2Row[] };

  const campaignsV2Rows = (campaignsV2 || []) as CampaignV2Row[];

  const v2CampaignIdByLegacy = new Map(campaignsV2Rows.map((campaign) => [campaign.legacy_campaign_id, campaign.id]));
  const v2CampaignNameByLegacy = new Map(campaignsV2Rows.map((campaign) => [campaign.legacy_campaign_id, campaign.name]));

  const { data: campaignPlatforms } = campaignsV2Rows.length
    ? await supabase
        .from('campaign_platforms_v2')
        .select('id, campaign_id, platform, rate_per_1k, multiplier_100k, multiplier_250k, max_payout_per_video, is_enabled')
        .in('campaign_id', campaignsV2Rows.map((campaign) => campaign.id))
        .eq('is_enabled', true)
    : { data: [] as CampaignPlatformRow[] };

  const campaignPlatformRows = (campaignPlatforms || []) as CampaignPlatformRow[];
  const platformById = new Map(campaignPlatformRows.map((platform) => [platform.id, platform]));

  const { data: payoutBreakdowns } = payoutsRows.length
    ? await supabase
        .from('payout_breakdowns')
        .select('payout_id, campaign_platform_id, total_views, base_amount, multiplier, final_amount')
        .in('payout_id', payoutsRows.map((payout) => payout.id))
    : { data: [] as PayoutBreakdownRow[] };

  const payoutBreakdownRows = (payoutBreakdowns || []) as PayoutBreakdownRow[];

  const breakdownsByPayoutId = payoutBreakdownRows.reduce<Record<string, PayoutBreakdownRow[]>>((acc, row) => {
    if (!acc[row.payout_id]) acc[row.payout_id] = [];
    acc[row.payout_id].push(row);
    return acc;
  }, {});

  const payoutsByCampaign = payoutsRows.reduce<Record<string, PayoutRow[]>>((acc, payout) => {
    if (!acc[payout.campaign_id]) acc[payout.campaign_id] = [];
    acc[payout.campaign_id].push(payout);
    return acc;
  }, {});

  // Calculate pending payouts for completed campaigns
  const completedCampaigns = campaigns?.filter((c) => c.status === 'completed') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-gray-600">Manage clipper payouts and exports</p>
        </div>
        <div className="flex gap-2">
          <GeneratePayoutsButton campaigns={completedCampaigns} />
          <ExportPayoutsButton />
        </div>
      </div>

      {/* Payout Summary by Campaign */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {payoutsRows.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(payoutsByCampaign).map(([campaignId, campaignPayouts]) => {
                const campaignName =
                  v2CampaignNameByLegacy.get(campaignId) ||
                  getSingle(campaignPayouts[0]?.campaign)?.name ||
                  'Unknown campaign';

                const campaignTotals = campaignPayouts.reduce(
                  (acc, payout) => {
                    acc.views += payout.total_views || 0;
                    acc.base += payout.base_amount || 0;
                    acc.final += payout.final_amount || 0;
                    return acc;
                  },
                  { views: 0, base: 0, final: 0 }
                );

                const campaignV2Id = v2CampaignIdByLegacy.get(campaignId);
                const platformMetadata = campaignPlatformRows.filter((platform) => platform.campaign_id === campaignV2Id);

                const platformTotals = campaignPayouts.reduce<Record<string, { views: number; base: number; final: number }>>(
                  (acc, payout) => {
                    const breakdowns = breakdownsByPayoutId[payout.id] || [];
                    breakdowns.forEach((breakdown) => {
                      const platform = platformById.get(breakdown.campaign_platform_id)?.platform;
                      if (!platform) return;
                      if (!acc[platform]) acc[platform] = { views: 0, base: 0, final: 0 };
                      acc[platform].views += breakdown.total_views || 0;
                      acc[platform].base += breakdown.base_amount || 0;
                      acc[platform].final += breakdown.final_amount || 0;
                    });
                    return acc;
                  },
                  {}
                );

                return (
                  <div key={campaignId} className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-semibold">{campaignName}</p>
                        <p className="text-sm text-gray-500">
                          {campaignPayouts.length} payout{campaignPayouts.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(campaignTotals.final)}</p>
                        <p className="text-sm text-gray-500">
                          {formatViews(campaignTotals.views)} views • Base {formatCurrency(campaignTotals.base)}
                        </p>
                      </div>
                    </div>

                    {platformMetadata.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {platformMetadata.map((platform) => {
                          const totals = platformTotals[platform.platform] || { views: 0, base: 0, final: 0 };
                          return (
                            <div key={platform.id} className="rounded-md border p-3">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="uppercase">{platform.platform}</Badge>
                                <span className="text-xs text-gray-500">{formatViews(totals.views)}</span>
                              </div>
                              <p className="text-xs text-gray-600">Rate: {formatCurrency(platform.rate_per_1k)}/1K</p>
                              <p className="text-xs text-gray-600">100K+: {platform.multiplier_100k}x</p>
                              <p className="text-xs text-gray-600">250K+: {platform.multiplier_250k}x</p>
                              <p className="text-xs text-gray-600">
                                Cap: {platform.max_payout_per_video ? formatCurrency(platform.max_payout_per_video) : 'No cap'}
                              </p>
                              <p className="text-xs text-gray-600 mt-2">Base: {formatCurrency(totals.base)}</p>
                              <p className="text-sm font-semibold text-green-600">Final: {formatCurrency(totals.final)}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="space-y-3">
                      {campaignPayouts.map((payout) => (
                        <div
                          key={payout.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">
                                {getSingle(payout.profile)?.full_name || getSingle(payout.profile)?.email}
                              </p>
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
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                              <span>{formatViews(payout.total_views)} views</span>
                              <span>×{payout.multiplier} multiplier</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">
                              {formatCurrency(payout.final_amount)}
                            </p>
                            <p className="text-sm text-gray-500">
                              Base: {formatCurrency(payout.base_amount)}
                            </p>
                          </div>
                          <div className="ml-4">
                            <PayoutActions payoutId={payout.id} status={payout.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No payouts yet. Generate payouts for completed campaigns.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
