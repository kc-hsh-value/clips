import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractTweetId, isValidTweetUrl, fetchTweetViews } from '@/lib/twitter';

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { campaignId, tweetUrl } = body;

  if (!campaignId || !tweetUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!isValidTweetUrl(tweetUrl)) {
    return NextResponse.json({ error: 'Invalid tweet URL' }, { status: 400 });
  }

  const tweetId = extractTweetId(tweetUrl);
  if (!tweetId) {
    return NextResponse.json({ error: 'Could not extract tweet ID' }, { status: 400 });
  }

  // Check if already submitted today for this campaign
  const today = new Date().toISOString().split('T')[0];
  const { data: existingSubmission } = await supabase
    .from('submissions')
    .select('id')
    .eq('clipper_id', user.id)
    .eq('campaign_id', campaignId)
    .gte('submitted_at', `${today}T00:00:00`)
    .lt('submitted_at', `${today}T23:59:59`)
    .single();

  if (existingSubmission) {
    return NextResponse.json(
      { error: 'You have already submitted a clip for this campaign today' },
      { status: 400 }
    );
  }

  // Fetch initial views from Twitter API
  console.log('Fetching initial views for tweet:', tweetId);
  const initialViews = await fetchTweetViews(tweetId);
  console.log('Initial views:', initialViews);

  // Create submission with initial views
  const { data: submission, error } = await supabase
    .from('submissions')
    .insert({
      campaign_id: campaignId,
      clipper_id: user.id,
      tweet_url: tweetUrl,
      tweet_id: tweetId,
      status: 'pending',
      views: initialViews ?? 0,
      last_view_update: initialViews !== null ? new Date().toISOString() : null,
      submitted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating submission:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ 
    submission,
    initialViews: initialViews ?? 0,
  });
}
