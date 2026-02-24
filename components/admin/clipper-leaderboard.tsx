'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatViews, formatCurrency, calculatePayout } from '@/lib/payout';
import { Trophy, Medal, Award } from 'lucide-react';

interface ClipperStats {
  clipper_id: string;
  clipper_name: string;
  clipper_email: string;
  total_views: number;
  submission_count: number;
  estimated_earnings: number;
}

interface PlatformPayoutConfig {
  platform: 'x' | 'youtube' | 'tiktok';
  ratePerK: number;
  multiplier100k: number;
  multiplier250k: number;
  maxPayoutPerVideo: number | null;
}

interface ClipperLeaderboardProps {
  campaignId: string;
  platformConfigs: PlatformPayoutConfig[];
}

type PlatformLeaderboard = Record<string, ClipperStats[]>;
const PLATFORM_ORDER: Array<'x' | 'youtube' | 'tiktok'> = ['x', 'youtube', 'tiktok'];

const PLATFORM_LABELS: Record<'x' | 'youtube' | 'tiktok', string> = {
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
};

function getPlatformValue(
  relation:
    | { platform?: string | null }
    | Array<{ platform?: string | null }>
    | null
    | undefined
) {
  if (Array.isArray(relation)) return relation[0]?.platform || undefined;
  return relation?.platform || undefined;
}

export function ClipperLeaderboard({ campaignId, platformConfigs }: ClipperLeaderboardProps) {
  const [leaderboardByPlatform, setLeaderboardByPlatform] = useState<PlatformLeaderboard>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const supabase = createClient();

      const configByPlatform = Object.fromEntries(
        platformConfigs.map((config) => [config.platform, config])
      ) as Record<string, PlatformPayoutConfig>;

      // Get all approved submissions for this campaign with clipper info
      const { data: submissions, error } = await supabase
        .from('submissions_v2')
        .select(`
          views,
          clipper_id,
          campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform),
          clipper:profiles(id, full_name, email)
        `)
        .eq('campaign_id', campaignId)
        .eq('status', 'approved');

      if (!submissions || submissions.length === 0) {
        setLeaderboardByPlatform({});
        setLoading(false);
        return;
      }

      // Aggregate by platform + clipper
      const platformMap = new Map<string, Map<string, ClipperStats>>();

      for (const sub of submissions) {
        const clipper = sub.clipper as unknown as { id: string; full_name: string | null; email: string } | null;
        const platform = getPlatformValue(sub.campaign_platform as { platform?: string } | { platform?: string }[]);
        if (!clipper) continue;
        if (!platform) continue;

        const platformConfig = configByPlatform[platform];
        if (!platformConfig) continue;

        if (!platformMap.has(platform)) {
          platformMap.set(platform, new Map<string, ClipperStats>());
        }

        const clipperMap = platformMap.get(platform)!;

        const existing = clipperMap.get(clipper.id);
        const views = sub.views || 0;
        
        // Calculate earnings for this submission
        const payout = calculatePayout(
          views,
          platformConfig.ratePerK,
          platformConfig.multiplier100k,
          platformConfig.multiplier250k,
          platformConfig.maxPayoutPerVideo
        );
        const earnings = payout.cappedAmount;

        if (existing) {
          existing.total_views += views;
          existing.submission_count += 1;
          existing.estimated_earnings += earnings;
        } else {
          clipperMap.set(clipper.id, {
            clipper_id: clipper.id,
            clipper_name: clipper.full_name || 'Unknown',
            clipper_email: clipper.email,
            total_views: views,
            submission_count: 1,
            estimated_earnings: earnings,
          });
        }
      }

      const nextLeaderboardByPlatform: PlatformLeaderboard = {};
      for (const [platform, clipperMap] of platformMap.entries()) {
        nextLeaderboardByPlatform[platform] = Array.from(clipperMap.values()).sort(
          (a, b) => b.total_views - a.total_views
        );
      }

      setLeaderboardByPlatform(nextLeaderboardByPlatform);
      setLoading(false);
    }

    fetchLeaderboard();
  }, [campaignId, platformConfigs]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-gray-500">{index + 1}</span>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clipper Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const enabledPlatformSet = new Set(platformConfigs.map((config) => config.platform));
  const defaultPlatform = platformConfigs[0]?.platform || 'x';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Clipper Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultPlatform} className="w-full">
          <TabsList>
            {PLATFORM_ORDER.map((platform) => (
              <TabsTrigger key={platform} value={platform}>
                {PLATFORM_LABELS[platform]}
              </TabsTrigger>
            ))}
          </TabsList>

          {PLATFORM_ORDER.map((platform) => {
            const leaderboard = leaderboardByPlatform[platform] || [];
            const isEnabled = enabledPlatformSet.has(platform);

            return (
              <TabsContent key={platform} value={platform} className="mt-4">
                {!isEnabled ? (
                  <p className="text-gray-500">{PLATFORM_LABELS[platform]} is not enabled for this campaign</p>
                ) : leaderboard.length === 0 ? (
                  <p className="text-gray-500">No approved submissions yet for {PLATFORM_LABELS[platform]}</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold uppercase text-sm tracking-wide text-gray-700">
                        {PLATFORM_LABELS[platform]} leaderboard
                      </h3>
                      <Badge variant="outline" className="uppercase">
                        {leaderboard.length} clippers
                      </Badge>
                    </div>

                    {leaderboard.map((clipper, index) => (
                      <div
                        key={`${platform}-${clipper.clipper_id}`}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          index === 0 ? 'bg-yellow-50 border border-yellow-200' :
                          index === 1 ? 'bg-gray-50 border border-gray-200' :
                          index === 2 ? 'bg-amber-50 border border-amber-200' :
                          'bg-white border border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getRankIcon(index)}
                          <div>
                            <p className="font-medium">{clipper.clipper_name}</p>
                            <p className="text-sm text-gray-500">{clipper.clipper_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold">{formatViews(clipper.total_views)}</p>
                            <p className="text-xs text-gray-500">views</p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{clipper.submission_count} clips</Badge>
                          </div>
                          <div className="text-right min-w-[80px]">
                            <p className="font-semibold text-green-600">{formatCurrency(clipper.estimated_earnings)}</p>
                            <p className="text-xs text-gray-500">est. earnings</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
