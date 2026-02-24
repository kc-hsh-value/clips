import { NextResponse } from 'next/server';
import { fetchTikTokViewsFromUrl } from '@/lib/tiktok';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
  }

  const result = await fetchTikTokViewsFromUrl(videoUrl);

  if (result.views === null) {
    return NextResponse.json(
      { error: 'Could not fetch TikTok views (blocked or structure changed)' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    videoId: result.videoId,
    views: result.views,
  });
}
