'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Calculator } from 'lucide-react';
import { calculatePayout } from '@/lib/payout';
import { Campaign } from '@/lib/types';

interface GeneratePayoutsButtonProps {
  campaigns: Campaign[];
}

export function GeneratePayoutsButton({ campaigns }: GeneratePayoutsButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    if (campaigns.length === 0) {
      toast.error('No completed campaigns to process');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      for (const campaign of campaigns) {
        const { data: campaignV2 } = await supabase
          .from('campaigns_v2')
          .select('id')
          .eq('legacy_campaign_id', campaign.id)
          .maybeSingle();

        if (!campaignV2) continue;

        // Get all approved submissions for this campaign grouped by clipper
        const { data: submissions } = await supabase
          .from('submissions_v2')
          .select(`
            clipper_id,
            views,
            campaign_platform_id,
            campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(
              rate_per_1k,
              multiplier_100k,
              multiplier_250k,
              max_payout_per_video,
              platform
            )
          `)
          .eq('campaign_id', campaignV2.id)
          .eq('status', 'approved');

        if (!submissions) continue;

        // Group by clipper and calculate earnings per submission (respecting cap)
        const clipperEarnings: Record<
          string,
          {
            totalViews: number;
            totalEarnings: number;
            platformTotals: Record<string, { campaignPlatformId: string; totalViews: number; baseAmount: number; finalAmount: number }>;
          }
        > = {};

        submissions.forEach((s) => {
          const relation = (s as {
            campaign_platform?: {
              rate_per_1k?: number;
              multiplier_100k?: number;
              multiplier_250k?: number;
              max_payout_per_video?: number | null;
              platform?: string;
            } | {
              rate_per_1k?: number;
              multiplier_100k?: number;
              multiplier_250k?: number;
              max_payout_per_video?: number | null;
              platform?: string;
            }[] | null;
          }).campaign_platform;

          const platformConfig = Array.isArray(relation) ? relation[0] : relation;
          if (!platformConfig) return;

          const payout = calculatePayout(
            s.views,
            platformConfig.rate_per_1k || 0,
            platformConfig.multiplier_100k || 1,
            platformConfig.multiplier_250k || 1,
            platformConfig.max_payout_per_video ?? null
          );
          
          if (!clipperEarnings[s.clipper_id]) {
            clipperEarnings[s.clipper_id] = { totalViews: 0, totalEarnings: 0, platformTotals: {} };
          }

          clipperEarnings[s.clipper_id].totalViews += s.views;
          clipperEarnings[s.clipper_id].totalEarnings += payout.cappedAmount;

          if (s.campaign_platform_id) {
            if (!clipperEarnings[s.clipper_id].platformTotals[s.campaign_platform_id]) {
              clipperEarnings[s.clipper_id].platformTotals[s.campaign_platform_id] = {
                campaignPlatformId: s.campaign_platform_id,
                totalViews: 0,
                baseAmount: 0,
                finalAmount: 0,
              };
            }

            const bucket = clipperEarnings[s.clipper_id].platformTotals[s.campaign_platform_id];
            bucket.totalViews += s.views;
            bucket.baseAmount += payout.baseAmount;
            bucket.finalAmount += payout.cappedAmount;
          }
        });

        // Create payouts for each clipper
        for (const [clipperId, data] of Object.entries(clipperEarnings)) {
          // Check if payout already exists
          const { data: existingPayout } = await supabase
            .from('payouts')
            .select('id')
            .eq('campaign_id', campaign.id)
            .eq('clipper_id', clipperId)
            .single();

          if (existingPayout) continue;

          const { data: insertedPayout } = await supabase
            .from('payouts')
            .insert({
            campaign_id: campaign.id,
            clipper_id: clipperId,
            total_views: data.totalViews,
            base_amount: data.totalEarnings,
            multiplier: 1,
            final_amount: data.totalEarnings,
            status: 'pending',
          })
            .select('id')
            .single();

          if (insertedPayout) {
            const breakdownRows = Object.values(data.platformTotals).map((row) => ({
              payout_id: insertedPayout.id,
              campaign_platform_id: row.campaignPlatformId,
              total_views: row.totalViews,
              base_amount: row.baseAmount,
              multiplier: row.baseAmount > 0 ? row.finalAmount / row.baseAmount : 1,
              final_amount: row.finalAmount,
            }));

            if (breakdownRows.length > 0) {
              await supabase.from('payout_breakdowns').insert(breakdownRows);
            }
          }
        }
      }

      toast.success('Payouts generated successfully');
      router.refresh();
    } catch (error) {
      toast.error('Failed to generate payouts');
    }

    setLoading(false);
  };

  return (
    <Button onClick={handleGenerate} disabled={loading || campaigns.length === 0}>
      <Calculator className="h-4 w-4 mr-2" />
      Generate Payouts
    </Button>
  );
}
