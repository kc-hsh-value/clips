import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchTweetViews } from '@/lib/twitter';
import { fetchYouTubeViews } from '@/lib/youtube';
import { fetchTikTokViewsFromUrl } from '@/lib/tiktok';

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
    .from('submissions_v2')
    .select(`
      id,
      external_id,
      url,
      campaign:campaigns_v2!inner(status),
      campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform)
    `)
    .eq('status', 'approved')
    .eq('campaign.status', 'active');

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!submissions || submissions.length === 0) {
    return NextResponse.json({ message: 'No submissions to update', updated: 0 });
  }

  const updatableSubmissions = submissions.filter((submission) => {
    const relation = (submission as {
      campaign_platform?: { platform?: string } | { platform?: string }[] | null;
    }).campaign_platform;
    const platform = Array.isArray(relation) ? relation[0]?.platform : relation?.platform;
    return platform === 'x' || platform === 'youtube' || platform === 'tiktok';
  });

  if (updatableSubmissions.length === 0) {
    return NextResponse.json({
      message: 'No supported submissions to update',
      total: submissions.length,
      updatableTotal: 0,
      updated: 0,
      failed: 0,
      skipped: submissions.length,
    });
  }

  let xTotal = 0;
  let youtubeTotal = 0;
  let tiktokTotal = 0;

  let updated = 0;
  let failed = 0;

  for (const submission of updatableSubmissions) {
    try {
      if (!submission.external_id) {
        failed++;
        continue;
      }

      const relation = (submission as {
        campaign_platform?: { platform?: string } | { platform?: string }[] | null;
      }).campaign_platform;
      const platform = Array.isArray(relation) ? relation[0]?.platform : relation?.platform;

      let views: number | null = null;

      if (platform === 'x') {
        xTotal++;
        views = await fetchTweetViews(submission.external_id);
      } else if (platform === 'youtube') {
        youtubeTotal++;
        views = await fetchYouTubeViews(submission.external_id);
      } else if (platform === 'tiktok') {
        tiktokTotal++;
        if (submission.url) {
          const tiktokResult = await fetchTikTokViewsFromUrl(submission.url);
          views = tiktokResult.views;
        }
      } else {
        continue;
      }
      
      if (views !== null) {
        const { error: updateError } = await supabase
          .from('submissions_v2')
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
    updatableTotal: updatableSubmissions.length,
    xTotal,
    youtubeTotal,
    tiktokTotal,
    updated,
    failed,
    skipped: submissions.length - updatableSubmissions.length,
  });
}
