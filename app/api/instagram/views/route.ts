import { NextResponse } from 'next/server';
import { fetchInstagramStatsFromUrl, isValidInstagramUrl } from '@/lib/instagram';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const postUrl = searchParams.get('url');

  if (!postUrl) {
    return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
  }

  if (!isValidInstagramUrl(postUrl)) {
    return NextResponse.json({ error: 'Invalid Instagram URL' }, { status: 400 });
  }

  const stats = await fetchInstagramStatsFromUrl(postUrl);

  if (!stats) {
    return NextResponse.json({ error: 'Instagram API failed or post not found' }, { status: 502 });
  }

  return NextResponse.json({
    success: true,
    platform: 'instagram',
    id: stats.id,
    shortcode: stats.shortcode,
    views: stats.views,
    likes: stats.likes,
    comments: stats.comments,
    isVideo: stats.isVideo,
    type: stats.type,
    thumbnail: stats.thumbnail,
  });
}
