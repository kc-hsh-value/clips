export type YouTubeVideoKind = 'short' | 'long';

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeUrl(url: string): { videoId: string; kind: YouTubeVideoKind } | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const path = parsedUrl.pathname;

  const shortHost = host === 'youtu.be' || host.endsWith('.youtu.be');
  if (shortHost) {
    const candidate = path.replace(/^\//, '').split('/')[0];
    if (YOUTUBE_VIDEO_ID_REGEX.test(candidate)) {
      return { videoId: candidate, kind: 'long' };
    }
  }

  const isYouTubeHost =
    host === 'youtube.com' ||
    host === 'www.youtube.com' ||
    host === 'm.youtube.com' ||
    host.endsWith('.youtube.com');

  if (!isYouTubeHost) {
    return null;
  }

  const shortsMatch = path.match(/^\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  if (shortsMatch) {
    return { videoId: shortsMatch[1], kind: 'short' };
  }

  const embedMatch = path.match(/^\/(?:embed|v|e)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  if (embedMatch) {
    return { videoId: embedMatch[1], kind: 'long' };
  }

  const watchId = parsedUrl.searchParams.get('v');
  if (watchId && YOUTUBE_VIDEO_ID_REGEX.test(watchId)) {
    return { videoId: watchId, kind: 'long' };
  }

  return null;
}

export function extractYouTubeVideoId(url: string): string | null {
  return parseYouTubeUrl(url)?.videoId ?? null;
}

export async function fetchYouTubeStats(videoId: string): Promise<{ views: number; likes: number; comments: number } | null> {
  if (!videoId || !YOUTUBE_VIDEO_ID_REGEX.test(videoId)) {
    return null;
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY is not configured');
    return null;
  }

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });

    if (!response.ok) {
      console.error('YouTube API HTTP error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data?.error) {
      console.error('YouTube API Error:', data.error);
      return null;
    }

    if (!Array.isArray(data?.items) || data.items.length === 0) {
      return null;
    }

    const statistics = data.items[0]?.statistics || {};
    const views = Number(statistics.viewCount || 0);
    const likes = Number(statistics.likeCount || 0);
    const comments = Number(statistics.commentCount || 0);

    if (!Number.isFinite(views) || !Number.isFinite(likes) || !Number.isFinite(comments)) {
      return null;
    }

    return { views, likes, comments };
  } catch (error) {
    console.error('Failed to fetch YouTube stats:', error);
    return null;
  }
}

export async function fetchYouTubeViews(videoId: string): Promise<number | null> {
  const stats = await fetchYouTubeStats(videoId);
  return stats?.views ?? null;
}
