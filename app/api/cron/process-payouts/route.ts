import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculatePayout } from '@/lib/payout';

// This endpoint generates payouts for completed campaigns
export async function POST(request: Request) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Get campaigns that have ended but don't have payouts yet
  const today = new Date().toISOString().split('T')[0];
  
  const { data: campaigns, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'active')
    .lt('end_date', today);

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ message: 'No campaigns to process', processed: 0 });
  }

  let processed = 0;

  for (const campaign of campaigns) {
    // Mark campaign as completed
    await supabase
      .from('campaigns')
      .update({ status: 'completed' })
      .eq('id', campaign.id);

    const { data: campaignV2 } = await supabase
      .from('campaigns_v2')
      .select('id')
      .eq('legacy_campaign_id', campaign.id)
      .maybeSingle();

    if (!campaignV2) {
      processed++;
      continue;
    }

    // Get all approved submissions grouped by clipper
    const { data: submissions } = await supabase
      .from('submissions_v2')
      .select(`
        clipper_id,
        views,
        campaign_platform_id,
        campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(
          rate_per_1k,
          multiplier_100k,
          multiplier_250k,
          max_payout_per_video,
          platform
        )
      `)
      .eq('campaign_id', campaignV2.id)
      .eq('status', 'approved');

    if (!submissions) continue;

    // Group by clipper and calculate earnings per submission (respecting cap)
    const clipperEarnings: Record<
      string,
      {
        totalViews: number;
        totalEarnings: number;
        platformTotals: Record<string, { campaignPlatformId: string; totalViews: number; baseAmount: number; finalAmount: number }>;
      }
    > = {};

    submissions.forEach((s) => {
      const relation = (s as {
        campaign_platform?: {
          rate_per_1k?: number;
          multiplier_100k?: number;
          multiplier_250k?: number;
          max_payout_per_video?: number | null;
          platform?: string;
        } | {
          rate_per_1k?: number;
          multiplier_100k?: number;
          multiplier_250k?: number;
          max_payout_per_video?: number | null;
          platform?: string;
        }[] | null;
      }).campaign_platform;

      const platformConfig = Array.isArray(relation) ? relation[0] : relation;
      if (!platformConfig) return;

      const payout = calculatePayout(
        s.views,
        platformConfig.rate_per_1k || 0,
        platformConfig.multiplier_100k || 1,
        platformConfig.multiplier_250k || 1,
        platformConfig.max_payout_per_video ?? null
      );
      
      if (!clipperEarnings[s.clipper_id]) {
        clipperEarnings[s.clipper_id] = { totalViews: 0, totalEarnings: 0, platformTotals: {} };
      }

      clipperEarnings[s.clipper_id].totalViews += s.views;
      clipperEarnings[s.clipper_id].totalEarnings += payout.cappedAmount;

      if (s.campaign_platform_id) {
        if (!clipperEarnings[s.clipper_id].platformTotals[s.campaign_platform_id]) {
          clipperEarnings[s.clipper_id].platformTotals[s.campaign_platform_id] = {
            campaignPlatformId: s.campaign_platform_id,
            totalViews: 0,
            baseAmount: 0,
            finalAmount: 0,
          };
        }

        const bucket = clipperEarnings[s.clipper_id].platformTotals[s.campaign_platform_id];
        bucket.totalViews += s.views;
        bucket.baseAmount += payout.baseAmount;
        bucket.finalAmount += payout.cappedAmount;
      }
    });

    // Create payouts for each clipper
    for (const [clipperId, data] of Object.entries(clipperEarnings)) {
      // Check if payout already exists
      const { data: existingPayout } = await supabase
        .from('payouts')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('clipper_id', clipperId)
        .single();

      if (existingPayout) continue;

      const { data: insertedPayout } = await supabase
        .from('payouts')
        .insert({
        campaign_id: campaign.id,
        clipper_id: clipperId,
        total_views: data.totalViews,
        base_amount: data.totalEarnings,
        multiplier: 1,
        final_amount: data.totalEarnings,
        status: 'pending',
      })
        .select('id')
        .single();

      if (insertedPayout) {
        const breakdownRows = Object.values(data.platformTotals).map((row) => ({
          payout_id: insertedPayout.id,
          campaign_platform_id: row.campaignPlatformId,
          total_views: row.totalViews,
          base_amount: row.baseAmount,
          multiplier: row.baseAmount > 0 ? row.finalAmount / row.baseAmount : 1,
          final_amount: row.finalAmount,
        }));

        if (breakdownRows.length > 0) {
          await supabase.from('payout_breakdowns').insert(breakdownRows);
        }
      }

      // Notify clipper
      await supabase.from('notifications').insert({
        user_id: clipperId,
        type: 'payout_ready',
        title: 'Payout Ready',
        message: `Your payout of $${data.totalEarnings.toFixed(2)} for ${campaign.name} is ready!`,
      });
    }

    processed++;
  }

  return NextResponse.json({
    message: 'Payouts processed',
    processed,
  });
}
