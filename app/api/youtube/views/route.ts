import { NextResponse } from 'next/server';
import { fetchYouTubeStats, parseYouTubeUrl } from '@/lib/youtube';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
  }

  const parsed = parseYouTubeUrl(videoUrl);

  if (!parsed) {
    return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
  }

  const stats = await fetchYouTubeStats(parsed.videoId);

  if (!stats) {
    return NextResponse.json(
      { error: 'Failed to fetch data from YouTube or video is unavailable' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    videoId: parsed.videoId,
    videoType: parsed.kind,
    views: stats.views,
    likes: stats.likes,
    comments: stats.comments,
  });
}
