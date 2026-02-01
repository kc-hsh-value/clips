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
        // Get all approved submissions for this campaign grouped by clipper
        const { data: submissions } = await supabase
          .from('submissions')
          .select('clipper_id, views')
          .eq('campaign_id', campaign.id)
          .eq('status', 'approved');

        if (!submissions) continue;

        // Group by clipper and calculate earnings per submission (respecting cap)
        const clipperEarnings: Record<string, { totalViews: number; totalEarnings: number }> = {};
        submissions.forEach((s) => {
          const payout = calculatePayout(
            s.views,
            campaign.rate_per_1k,
            campaign.multiplier_100k,
            campaign.multiplier_250k,
            campaign.max_payout_per_video
          );
          
          if (!clipperEarnings[s.clipper_id]) {
            clipperEarnings[s.clipper_id] = { totalViews: 0, totalEarnings: 0 };
          }
          clipperEarnings[s.clipper_id].totalViews += s.views;
          clipperEarnings[s.clipper_id].totalEarnings += payout.cappedAmount;
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

          await supabase.from('payouts').insert({
            campaign_id: campaign.id,
            clipper_id: clipperId,
            total_views: data.totalViews,
            base_amount: data.totalEarnings,
            multiplier: 1,
            final_amount: data.totalEarnings,
            status: 'pending',
          });
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
