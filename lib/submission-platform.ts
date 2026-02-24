import { extractTweetId, fetchTweetViews, isValidTweetUrl } from '@/lib/twitter';
import { fetchYouTubeViews, parseYouTubeUrl } from '@/lib/youtube';
import { fetchTikTokViewsFromUrl } from '@/lib/tiktok';

export type SubmissionPlatform = 'x' | 'youtube' | 'tiktok';

export function isValidSubmissionUrl(platform: SubmissionPlatform, url: string): boolean {
  if (platform === 'x') return isValidTweetUrl(url);

  if (platform === 'youtube') {
    return parseYouTubeUrl(url) !== null;
  }

  if (platform === 'tiktok') {
    return /(?:tiktok\.com\/.*\/video\/|vm\.tiktok\.com\/)[A-Za-z0-9_-]+/.test(url);
  }

  return false;
}

export function extractExternalId(platform: SubmissionPlatform, url: string): string | null {
  if (platform === 'x') {
    return extractTweetId(url);
  }

  if (platform === 'youtube') {
    return parseYouTubeUrl(url)?.videoId ?? null;
  }

  if (platform === 'tiktok') {
    const videoMatch = url.match(/\/video\/(\d+)/);
    if (videoMatch) return videoMatch[1];

    const vmMatch = url.match(/vm\.tiktok\.com\/([A-Za-z0-9_-]+)/);
    if (vmMatch) return vmMatch[1];

    return null;
  }

  return null;
}

export async function fetchInitialViews(
  platform: SubmissionPlatform,
  externalId: string,
  options?: { url?: string }
): Promise<number | null> {
  if (platform === 'x') {
    return fetchTweetViews(externalId);
  }

  if (platform === 'youtube') {
    return fetchYouTubeViews(externalId);
  }

  if (platform === 'tiktok' && options?.url) {
    const result = await fetchTikTokViewsFromUrl(options.url);
    return result.views;
  }

  return null;
}
