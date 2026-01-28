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

        // Group by clipper and sum views
        const clipperViews: Record<string, number> = {};
        submissions.forEach((s) => {
          clipperViews[s.clipper_id] = (clipperViews[s.clipper_id] || 0) + s.views;
        });

        // Create payouts for each clipper
        for (const [clipperId, totalViews] of Object.entries(clipperViews)) {
          // Check if payout already exists
          const { data: existingPayout } = await supabase
            .from('payouts')
            .select('id')
            .eq('campaign_id', campaign.id)
            .eq('clipper_id', clipperId)
            .single();

          if (existingPayout) continue;

          const payout = calculatePayout(
            totalViews,
            campaign.rate_per_1k,
            campaign.multiplier_100k,
            campaign.multiplier_250k
          );

          await supabase.from('payouts').insert({
            campaign_id: campaign.id,
            clipper_id: clipperId,
            total_views: totalViews,
            base_amount: payout.baseAmount,
            multiplier: payout.multiplier,
            final_amount: payout.finalAmount,
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
