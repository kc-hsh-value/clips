import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchTweetViews } from '@/lib/twitter';
import { fetchYouTubeViews } from '@/lib/youtube';
import { fetchTikTokViewsFromUrl } from '@/lib/tiktok';
import { fetchInstagramStatsFromUrl } from '@/lib/instagram';

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
    .from('submissions_v2')
    .select(`
      id,
      external_id,
      url,
      campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform)
    `)
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

  const updatableSubmissions = submissions.filter((submission) => {
    const relation = (submission as {
      campaign_platform?: { platform?: string } | { platform?: string }[] | null;
    }).campaign_platform;
    const platform = Array.isArray(relation) ? relation[0]?.platform : relation?.platform;
    return platform === 'x' || platform === 'youtube' || platform === 'tiktok' || platform === 'instagram';
  });

  if (updatableSubmissions.length === 0) {
    return NextResponse.json({
      message: 'No approved supported submissions to update',
      total: submissions.length,
      updatableTotal: 0,
      updated: 0,
      failed: 0,
      skipped: submissions.length,
    });
  }

  let updated = 0;
  let failed = 0;
  let xTotal = 0;
  let youtubeTotal = 0;
  let tiktokTotal = 0;
  let instagramTotal = 0;
  const results: { id: string; views: number | null; error?: string }[] = [];

  for (const submission of updatableSubmissions) {
    try {
      const relation = (submission as {
        campaign_platform?: { platform?: string } | { platform?: string }[] | null;
      }).campaign_platform;
      const platform = Array.isArray(relation) ? relation[0]?.platform : relation?.platform;

      if ((platform === 'x' || platform === 'youtube') && !submission.external_id) {
        failed++;
        results.push({ id: submission.id, views: null, error: 'Missing external_id' });
        continue;
      }

      let views: number | null = null;

      if (platform === 'x') {
        xTotal++;
        views = await fetchTweetViews(submission.external_id);
      } else if (platform === 'youtube') {
        youtubeTotal++;
        views = await fetchYouTubeViews(submission.external_id);
      } else if (platform === 'tiktok') {
        tiktokTotal++;
        if (!(submission as { url?: string | null }).url) {
          failed++;
          results.push({ id: submission.id, views: null, error: 'Missing url' });
          continue;
        }

        const tiktokResult = await fetchTikTokViewsFromUrl((submission as { url: string }).url);
        views = tiktokResult.views;
      } else if (platform === 'instagram') {
        instagramTotal++;
        if (!(submission as { url?: string | null }).url) {
          failed++;
          results.push({ id: submission.id, views: null, error: 'Missing url' });
          continue;
        }

        const instagramResult = await fetchInstagramStatsFromUrl((submission as { url: string }).url);
        views = instagramResult?.views ?? null;
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
    updatableTotal: updatableSubmissions.length,
    xTotal,
    youtubeTotal,
    tiktokTotal,
    instagramTotal,
    updated,
    failed,
    skipped: submissions.length - updatableSubmissions.length,
    results,
  });
}
