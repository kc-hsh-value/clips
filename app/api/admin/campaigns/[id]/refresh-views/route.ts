import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchTweetViews } from '@/lib/twitter';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: campaignId } = await params;
  const supabase = await createClient();

  // Check if user is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Get all approved submissions for this campaign
  const { data: submissions, error: fetchError } = await supabase
    .from('submissions')
    .select('id, tweet_id')
    .eq('campaign_id', campaignId)
    .eq('status', 'approved');

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ 
      message: 'No approved submissions to update',
      updated: 0,
      total: 0,
    });
  }

  let updated = 0;
  let failed = 0;
  const results: { id: string; views: number | null; error?: string }[] = [];

  for (const submission of submissions) {
    try {
      console.log('Fetching views for submission:', submission.id, 'tweet:', submission.tweet_id);
      const views = await fetchTweetViews(submission.tweet_id);
      console.log('Got views:', views);

      if (views !== null) {
        const { error: updateError } = await supabase
          .from('submissions')
          .update({
            views,
            last_view_update: new Date().toISOString(),
          })
          .eq('id', submission.id);

        if (!updateError) {
          updated++;
          results.push({ id: submission.id, views });
        } else {
          failed++;
          results.push({ id: submission.id, views: null, error: updateError.message });
        }
      } else {
        failed++;
        results.push({ id: submission.id, views: null, error: 'Failed to fetch views' });
      }
    } catch (error) {
      failed++;
      results.push({ id: submission.id, views: null, error: String(error) });
    }

    // Rate limiting: wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return NextResponse.json({
    message: 'View counts updated',
    total: submissions.length,
    updated,
    failed,
    results,
  });
}
