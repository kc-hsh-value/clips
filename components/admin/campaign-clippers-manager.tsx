'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { UserPlus, X } from 'lucide-react';
import { Profile } from '@/lib/types';

interface CampaignClippersManagerProps {
  campaignId: string;
}

type Platform = 'x' | 'youtube' | 'tiktok' | 'instagram';

interface CampaignPlatform {
  id: string;
  platform: Platform;
  is_enabled: boolean;
  daily_submission_limit: number;
}

const PLATFORM_LABELS: Record<Platform, string> = {
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

export function CampaignClippersManager({ campaignId }: CampaignClippersManagerProps) {
  const [clippers, setClippers] = useState<(Profile & { joined_at: string })[]>([]);
  const [availableClippers, setAvailableClippers] = useState<Profile[]>([]);
  const [platforms, setPlatforms] = useState<CampaignPlatform[]>([]);
  const [limitByClipperPlatform, setLimitByClipperPlatform] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const limitKey = (clipperId: string, platformId: string) => `${clipperId}:${platformId}`;

  useEffect(() => {
    fetchClippers();
  }, [campaignId]);

  const fetchClippers = async () => {
    if (!campaignId) return;

    const supabase = createClient();

    const { data: campaignPlatforms } = await supabase
      .from('campaign_platforms_v2')
      .select('id, platform, is_enabled, daily_submission_limit')
      .eq('campaign_id', campaignId)
      .eq('is_enabled', true);

    const platformRows = (campaignPlatforms || []) as CampaignPlatform[];
    setPlatforms(platformRows);
    
    // Get clippers in this campaign
    const { data: campaignClippers } = await supabase
      .from('campaign_clippers_v2')
      .select(`
        joined_at,
        clipper:profiles(*)
      `)
      .eq('campaign_id', campaignId);

    if (campaignClippers) {
      const mappedClippers = campaignClippers.map((cc) => ({
          ...(cc.clipper as unknown as Profile),
          joined_at: cc.joined_at,
        }));

      setClippers(mappedClippers);

      const clipperIds = mappedClippers.map((clipper) => clipper.id);
      const platformIds = platformRows.map((platform) => platform.id);

      if (clipperIds.length > 0 && platformIds.length > 0) {
        const { data: limitRows } = await supabase
          .from('campaign_platform_clipper_limits_v2')
          .select('campaign_platform_id, clipper_id, daily_submission_limit')
          .in('clipper_id', clipperIds)
          .in('campaign_platform_id', platformIds);

        const nextLimits: Record<string, number> = {};

        platformRows.forEach((platform) => {
          clipperIds.forEach((clipperId) => {
            nextLimits[limitKey(clipperId, platform.id)] = platform.daily_submission_limit ?? 1;
          });
        });

        (limitRows || []).forEach((row) => {
          nextLimits[limitKey(row.clipper_id, row.campaign_platform_id)] = row.daily_submission_limit;
        });

        setLimitByClipperPlatform(nextLimits);
      } else {
        setLimitByClipperPlatform({});
      }
    }

    // Get available clippers (approved but not in this campaign)
    const { data: allClippers } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'clipper')
      .eq('status', 'approved');

    if (allClippers && campaignClippers) {
      const assignedIds = campaignClippers.map((cc) => (cc.clipper as unknown as Profile).id);
      setAvailableClippers(allClippers.filter((c) => !assignedIds.includes(c.id)));
    }
  };

  const addClipper = async (clipperId: string) => {
    setLoading(true);
    const supabase = createClient();
    
    const { error } = await supabase.from('campaign_clippers_v2').insert({
      campaign_id: campaignId,
      clipper_id: clipperId,
    });

    if (error) {
      toast.error(error.message);
    } else {
      if (platforms.length > 0) {
        await supabase.from('campaign_platform_clipper_limits_v2').upsert(
          platforms.map((platform) => ({
            campaign_platform_id: platform.id,
            clipper_id: clipperId,
            daily_submission_limit: platform.daily_submission_limit ?? 1,
          })),
          { onConflict: 'campaign_platform_id,clipper_id' }
        );
      }

      toast.success('Clipper added to campaign');
      fetchClippers();
    }
    setLoading(false);
  };

  const removeClipper = async (clipperId: string) => {
    setLoading(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('campaign_clippers_v2')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('clipper_id', clipperId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Clipper removed from campaign');
      fetchClippers();
    }
    setLoading(false);
  };

  const updateDailyLimit = async (clipperId: string, campaignPlatformId: string, nextValue: number) => {
    if (Number.isNaN(nextValue) || nextValue < 0) {
      toast.error('Daily limit must be a number >= 0');
      return;
    }

    const normalizedValue = Math.floor(nextValue);
    const supabase = createClient();

    const { error } = await supabase
      .from('campaign_platform_clipper_limits_v2')
      .upsert(
        {
          campaign_platform_id: campaignPlatformId,
          clipper_id: clipperId,
          daily_submission_limit: normalizedValue,
        },
        { onConflict: 'campaign_platform_id,clipper_id' }
      );

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Daily limit updated');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Clippers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Clippers */}
        {clippers.length > 0 ? (
          <div className="space-y-2">
            {clippers.map((clipper) => (
              <div
                key={clipper.id}
                className="p-3 bg-gray-50 rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{clipper.full_name || clipper.email}</p>
                    <p className="text-sm text-gray-500">{clipper.email}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeClipper(clipper.id)}
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {platforms.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {platforms.map((platform) => {
                      const key = limitKey(clipper.id, platform.id);
                      const value = limitByClipperPlatform[key] ?? platform.daily_submission_limit ?? 1;

                      return (
                        <div key={platform.id} className="space-y-1">
                          <p className="text-xs text-gray-500 uppercase">{PLATFORM_LABELS[platform.platform]} daily limit</p>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={value}
                            onChange={(e) => {
                              const parsed = Number(e.target.value);
                              setLimitByClipperPlatform((prev) => ({
                                ...prev,
                                [key]: Number.isNaN(parsed) ? 0 : parsed,
                              }));
                            }}
                            onBlur={(e) => {
                              const parsed = Number(e.target.value);
                              updateDailyLimit(clipper.id, platform.id, parsed);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No clippers assigned</p>
        )}

        {/* Add Clipper */}
        {availableClippers.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Add Clippers</p>
            <div className="flex flex-wrap gap-2">
              {availableClippers.map((clipper) => (
                <Button
                  key={clipper.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addClipper(clipper.id)}
                  disabled={loading}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  {clipper.full_name || clipper.email}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
