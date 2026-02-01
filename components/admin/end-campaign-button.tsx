'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { StopCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface EndCampaignButtonProps {
  campaignId: string;
  campaignName: string;
}

export function EndCampaignButton({ campaignId, campaignName }: EndCampaignButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const endCampaign = async () => {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('campaigns')
      .update({ 
        status: 'completed',
        end_date: new Date().toISOString().split('T')[0]
      })
      .eq('id', campaignId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Campaign ended successfully');
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <StopCircle className="h-4 w-4 mr-2" />
          End Campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End Campaign Early?</DialogTitle>
          <DialogDescription>
            Are you sure you want to end &quot;{campaignName}&quot;? This will mark the campaign as
            completed and set the end date to today. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={endCampaign} disabled={loading}>
            {loading ? 'Ending...' : 'End Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
