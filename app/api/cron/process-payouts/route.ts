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

    // Get all approved submissions grouped by clipper
    const { data: submissions } = await supabase
      .from('submissions')
      .select('clipper_id, views')
      .eq('campaign_id', campaign.id)
      .eq('status', 'approved');

    if (!submissions) continue;

    // Group by clipper and calculate earnings per submission (respecting cap)
    const clipperEarnings: Record<string, { totalViews: number; totalEarnings: number }> = {};
    submissions.forEach((s) => {
      const payout = calculatePayout(
        s.views,
        campaign.rate_per_1k,
        campaign.multiplier_100k,
        campaign.multiplier_250k,
        campaign.max_payout_per_video
      );
      
      if (!clipperEarnings[s.clipper_id]) {
        clipperEarnings[s.clipper_id] = { totalViews: 0, totalEarnings: 0 };
      }
      clipperEarnings[s.clipper_id].totalViews += s.views;
      clipperEarnings[s.clipper_id].totalEarnings += payout.cappedAmount;
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

      await supabase.from('payouts').insert({
        campaign_id: campaign.id,
        clipper_id: clipperId,
        total_views: data.totalViews,
        base_amount: data.totalEarnings,
        multiplier: 1,
        final_amount: data.totalEarnings,
        status: 'pending',
      });

      // Notify clipper
      await supabase.from('notifications').insert({
        user_id: clipperId,
        type: 'payout_ready',
        title: 'Payout Ready',
        message: `Your payout of $${payout.finalAmount.toFixed(2)} for ${campaign.name} is ready!`,
      });
    }

    processed++;
  }

  return NextResponse.json({
    message: 'Payouts processed',
    processed,
  });
}
