import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchTweetViews } from '@/lib/twitter';

// This endpoint can be called by a cron job (e.g., Vercel Cron)
// to update view counts for all approved submissions
export async function GET(request: Request) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createServiceClient();

  // Get all approved submissions from active campaigns
  const { data: submissions, error: fetchError } = await supabase
    .from('submissions')
    .select(`
      id,
      tweet_id,
      campaign:campaigns!inner(status)
    `)
    .eq('status', 'approved')
    .eq('campaign.status', 'active');

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ message: 'No submissions to update', updated: 0 });
  }

  let updated = 0;
  let failed = 0;

  for (const submission of submissions) {
    try {
      const views = await fetchTweetViews(submission.tweet_id);
      
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
        } else {
          failed++;
        }
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
    }

    // Rate limiting: wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return NextResponse.json({
    message: 'View counts updated',
    total: submissions.length,
    updated,
    failed,
  });
}
