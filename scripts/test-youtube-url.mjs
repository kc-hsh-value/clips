#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

function loadEnvLocalFallback() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseYouTubeUrl(url) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;

  const shortHost = host === 'youtu.be' || host.endsWith('.youtu.be');
  if (shortHost) {
    const candidate = pathname.replace(/^\//, '').split('/')[0];
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

  const shortsMatch = pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  if (shortsMatch) {
    return { videoId: shortsMatch[1], kind: 'short' };
  }

  const embedMatch = pathname.match(/^\/(?:embed|v|e)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  if (embedMatch) {
    return { videoId: embedMatch[1], kind: 'long' };
  }

  const watchId = parsedUrl.searchParams.get('v');
  if (watchId && YOUTUBE_VIDEO_ID_REGEX.test(watchId)) {
    return { videoId: watchId, kind: 'long' };
  }

  return null;
}

async function main() {
  const inputUrl = process.argv[2];

  if (!inputUrl) {
    console.error('Usage: node scripts/test-youtube-url.mjs <youtube-url>');
    process.exit(1);
  }

  loadEnvLocalFallback();

  const parsed = parseYouTubeUrl(inputUrl);
  if (!parsed) {
    console.error('Invalid YouTube URL according to parser');
    process.exit(1);
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('Missing YOUTUBE_API_KEY (not in environment or .env.local)');
    process.exit(1);
  }

  const apiUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,status&id=${parsed.videoId}&key=${apiKey}`;

  console.log('--- YouTube Debug ---');
  console.log('Input URL:', inputUrl);
  console.log('Parsed:', parsed);
  console.log('API URL:', apiUrl.replace(apiKey, '***'));

  const response = await fetch(apiUrl, { cache: 'no-store' });
  const json = await response.json();

  console.log('\nHTTP:', response.status, response.statusText);

  if (json?.error) {
    console.log('\nAPI Error:');
    console.dir(json.error, { depth: null });
    process.exit(1);
  }

  if (!Array.isArray(json?.items) || json.items.length === 0) {
    console.log('\nNo items returned. Video may be unavailable/private/region-restricted.');
    console.dir(json, { depth: null });
    process.exit(1);
  }

  const item = json.items[0];
  const stats = item.statistics || {};

  const libViews = Number(stats.viewCount || 0);
  const strictViews = stats.viewCount == null ? null : Number(stats.viewCount);

  console.log('\nVideo Metadata:');
  console.log('Title:', item?.snippet?.title ?? '(missing)');
  console.log('Privacy:', item?.status?.privacyStatus ?? '(missing)');
  console.log('Upload Status:', item?.status?.uploadStatus ?? '(missing)');

  console.log('\nStatistics Raw:');
  console.dir(stats, { depth: null });

  console.log('\nComputed:');
  console.log('lib/youtube.ts views logic -> Number(viewCount || 0):', Number.isFinite(libViews) ? libViews : 'NaN');
  console.log('strict viewCount parse (null if missing):', strictViews);

  if (stats.viewCount == null) {
    console.log('\nReason candidate: statistics.viewCount is missing, so fallback logic returns 0.');
  }
}

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
