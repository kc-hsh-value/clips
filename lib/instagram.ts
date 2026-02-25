export interface InstagramStats {
  id: string | null;
  shortcode: string | null;
  views: number;
  likes: number;
  comments: number;
  isVideo: boolean;
  type: string | null;
  thumbnail: string | null;
}

function parseNumber(input: unknown): number {
  const value = Number(input ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function parseInstagramShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return match?.[1] || null;
}

export function isValidInstagramUrl(url: string): boolean {
  return /(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|p|tv)\/[A-Za-z0-9_-]+/i.test(url);
}

export async function fetchInstagramStatsFromUrl(postUrl: string): Promise<InstagramStats | null> {
  const apiKey = process.env.RAPID_API_KEY;
  const apiHost = process.env.RAPID_API_HOST || 'instagram-looter2.p.rapidapi.com';

  if (!apiKey) {
    console.error('RAPID_API_KEY is not configured');
    return null;
  }

  const targetUrl = `https://${apiHost}/post?url=${encodeURIComponent(postUrl)}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': apiHost,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Instagram API HTTP error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data || (!data.status && !data.id)) {
      return null;
    }

    const views = parseNumber(data.video_play_count ?? data.video_view_count ?? 0);
    const likes = parseNumber(data.edge_media_preview_like?.count ?? 0);
    const comments = parseNumber(
      data.edge_media_to_parent_comment?.count ??
      data.edge_media_preview_comment?.count ??
      data.edge_media_to_comment?.count ??
      0
    );

    return {
      id: data.id ? String(data.id) : null,
      shortcode: data.shortcode ? String(data.shortcode) : parseInstagramShortcode(postUrl),
      views,
      likes,
      comments,
      isVideo: Boolean(data.is_video),
      type: data.product_type ? String(data.product_type) : null,
      thumbnail: data.thumbnail_src ? String(data.thumbnail_src) : null,
    };
  } catch (error) {
    console.error('Instagram fetch failed:', error);
    return null;
  }
}
