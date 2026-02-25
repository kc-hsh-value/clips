import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  extractExternalId,
  fetchInitialViews,
  isValidSubmissionUrl,
  type SubmissionPlatform,
} from '@/lib/submission-platform';

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { campaignId, campaignPlatformId, url } = body;

  if (!campaignId || !campaignPlatformId || !url) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate clipper assignment to campaign (v2)
  const { data: assignment } = await supabase
    .from('campaign_clippers_v2')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('clipper_id', user.id)
    .single();

  if (!assignment) {
    return NextResponse.json({ error: 'You are not assigned to this campaign' }, { status: 403 });
  }

  // Validate selected campaign platform belongs to campaign and is enabled
  const { data: campaignPlatform } = await supabase
    .from('campaign_platforms_v2')
    .select('id, campaign_id, platform, is_enabled, daily_submission_limit')
    .eq('id', campaignPlatformId)
    .single();

  if (!campaignPlatform || campaignPlatform.campaign_id !== campaignId || !campaignPlatform.is_enabled) {
    return NextResponse.json({ error: 'Invalid or disabled campaign platform' }, { status: 400 });
  }

  const platform = campaignPlatform.platform as SubmissionPlatform;

  if (!isValidSubmissionUrl(platform, url)) {
    return NextResponse.json({ error: `Invalid ${platform.toUpperCase()} URL` }, { status: 400 });
  }

  const externalId = extractExternalId(platform, url);
  if (!externalId) {
    return NextResponse.json({ error: 'Could not extract external ID from URL' }, { status: 400 });
  }

  // Resolve per-clipper daily limit for this campaign platform
  const { data: limitRow } = await supabase
    .from('campaign_platform_clipper_limits_v2')
    .select('daily_submission_limit')
    .eq('campaign_platform_id', campaignPlatformId)
    .eq('clipper_id', user.id)
    .maybeSingle();

  const dailyLimit =
    limitRow?.daily_submission_limit ?? campaignPlatform.daily_submission_limit ?? 1;

  if (dailyLimit <= 0) {
    return NextResponse.json(
      { error: 'You are not allowed to submit clips for this campaign platform today' },
      { status: 403 }
    );
  }

  // Check today's submission count against dynamic limit
  const today = new Date().toISOString().split('T')[0];
  const { count: todaySubmissionCount } = await supabase
    .from('submissions_v2')
    .select('id', { count: 'exact', head: true })
    .eq('clipper_id', user.id)
    .eq('campaign_platform_id', campaignPlatformId)
    .gte('submitted_at', `${today}T00:00:00`)
    .lt('submitted_at', `${today}T23:59:59`);

  if ((todaySubmissionCount || 0) >= dailyLimit) {
    return NextResponse.json(
      { error: `Daily limit reached for this campaign platform (${dailyLimit} submissions)` },
      { status: 400 }
    );
  }

  // Fetch initial views for supported providers (currently X)
  console.log('Fetching initial views for platform:', platform, 'externalId:', externalId);
  const initialViews = await fetchInitialViews(platform, externalId, { url });
  console.log('Initial views:', initialViews);

  // Create submission with initial views
  const { data: submission, error } = await supabase
    .from('submissions_v2')
    .insert({
      campaign_id: campaignId,
      campaign_platform_id: campaignPlatformId,
      clipper_id: user.id,
      url,
      external_id: externalId,
      status: 'pending',
      views: initialViews ?? 0,
      last_view_update: initialViews !== null ? new Date().toISOString() : null,
      submitted_day: today,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating submission:', error);

    if (error.code === '23505') {
      if (error.message.includes('submissions_v2_campaign_platform_id_clipper_id_submitted_da_key')) {
        return NextResponse.json(
          {
            error:
              'Database still enforces one submission per day for this platform. Run supabase/allow_multiple_daily_submissions_v2.sql to enable dynamic daily limits.',
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Duplicate submission detected for this post/platform/day' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    submission,
    initialViews: initialViews ?? 0,
  });
}
