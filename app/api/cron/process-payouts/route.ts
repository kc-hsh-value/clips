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

    // Group by clipper and sum views
    const clipperViews: Record<string, number> = {};
    submissions.forEach((s) => {
      clipperViews[s.clipper_id] = (clipperViews[s.clipper_id] || 0) + s.views;
    });

    // Create payouts for each clipper
    for (const [clipperId, totalViews] of Object.entries(clipperViews)) {
      // Check if payout already exists
      const { data: existingPayout } = await supabase
        .from('payouts')
        .select('id')
        .eq('campaign_id', campaign.id)
        .eq('clipper_id', clipperId)
        .single();

      if (existingPayout) continue;

      const payout = calculatePayout(
        totalViews,
        campaign.rate_per_1k,
        campaign.multiplier_100k,
        campaign.multiplier_250k
      );

      await supabase.from('payouts').insert({
        campaign_id: campaign.id,
        clipper_id: clipperId,
        total_views: totalViews,
        base_amount: payout.baseAmount,
        multiplier: payout.multiplier,
        final_amount: payout.finalAmount,
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
