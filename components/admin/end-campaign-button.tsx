'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [confirmationName, setConfirmationName] = useState('');
  const router = useRouter();

  const isConfirmationValid = confirmationName.trim() === campaignName;

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
      setConfirmationName('');
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmationName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
            To confirm, type <strong>{campaignName}</strong> below. This will mark the campaign as
            completed and set the end date to today. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Campaign name</p>
          <Input
            value={confirmationName}
            onChange={(e) => setConfirmationName(e.target.value)}
            placeholder={campaignName}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={endCampaign} disabled={loading || !isConfirmationValid}>
            {loading ? 'Ending...' : 'End Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
