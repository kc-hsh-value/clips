import * as cheerio from 'cheerio';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};

function getNested(obj: JsonValue, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function parseJsonSafely(input: string | null | undefined): JsonValue | null {
  if (!input) return null;
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function findPlayCountInItemModule(parsed: JsonValue): { videoId?: string; views?: number } | null {
  const itemModule = getNested(parsed, ['ItemModule']);
  if (!itemModule || typeof itemModule !== 'object') return null;

  const values = Object.values(itemModule as Record<string, unknown>);
  for (const item of values) {
    if (!item || typeof item !== 'object') continue;
    const videoId = (item as Record<string, unknown>).id;
    const stats = (item as Record<string, unknown>).stats;
    const playCount = stats && typeof stats === 'object' ? (stats as Record<string, unknown>).playCount : undefined;

    const numericViews = Number(playCount);
    if (Number.isFinite(numericViews)) {
      return {
        videoId: typeof videoId === 'string' ? videoId : undefined,
        views: numericViews,
      };
    }
  }

  return null;
}

export function extractTikTokVideoId(url: string): string | null {
  const videoMatch = url.match(/\/video\/(\d+)/);
  if (videoMatch) return videoMatch[1];

  const vmMatch = url.match(/vm\.tiktok\.com\/([A-Za-z0-9_-]+)/);
  if (vmMatch) return vmMatch[1];

  return null;
}

export async function fetchTikTokViewsFromUrl(url: string): Promise<{ videoId: string | null; views: number | null }> {
  try {
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!response.ok) {
      return { videoId: null, views: null };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const universalDataRaw = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
    const sigiStateRaw = $('#SIGI_STATE').html();

    const universalData = parseJsonSafely(universalDataRaw);
    const sigiState = parseJsonSafely(sigiStateRaw);

    const defaultScopeVideo = getNested(universalData, ['__DEFAULT_SCOPE__', 'webapp.video-detail', 'itemInfo', 'itemStruct']);
    if (defaultScopeVideo && typeof defaultScopeVideo === 'object') {
      const record = defaultScopeVideo as Record<string, unknown>;
      const stats = record.stats;
      const playCount = stats && typeof stats === 'object' ? (stats as Record<string, unknown>).playCount : undefined;
      const numericViews = Number(playCount);

      if (Number.isFinite(numericViews)) {
        return {
          videoId: typeof record.id === 'string' ? record.id : extractTikTokVideoId(url),
          views: numericViews,
        };
      }
    }

    const itemModuleResult = findPlayCountInItemModule(sigiState);
    if (itemModuleResult?.views !== undefined) {
      return {
        videoId: itemModuleResult.videoId ?? extractTikTokVideoId(url),
        views: itemModuleResult.views,
      };
    }

    return {
      videoId: extractTikTokVideoId(url),
      views: null,
    };
  } catch (error) {
    console.error('TikTok scraping failed:', error);
    return { videoId: extractTikTokVideoId(url), views: null };
  }
}
