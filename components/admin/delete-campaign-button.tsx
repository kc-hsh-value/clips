'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DeleteCampaignButtonProps {
  campaignId: string;
  campaignName: string;
  submissionCount?: number;
}

export function DeleteCampaignButton({ 
  campaignId, 
  campaignName, 
  submissionCount = 0 
}: DeleteCampaignButtonProps) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmationName, setConfirmationName] = useState('');
  const router = useRouter();

  const isConfirmationValid = confirmationName.trim() === campaignName;

  const deleteCampaign = async () => {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Campaign deleted successfully');
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
        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Campaign</DialogTitle>
          <DialogDescription>
            To confirm deletion, type <strong>{campaignName}</strong> below.
            {submissionCount > 0 && (
              <>
                <br /><br />
                <span className="text-red-600 font-medium">
                  ⚠️ This will permanently delete {submissionCount} submission{submissionCount !== 1 ? 's' : ''} and all associated view counts.
                </span>
              </>
            )}
            <br /><br />
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Campaign name
          </p>
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
          <Button 
            variant="destructive" 
            onClick={deleteCampaign} 
            disabled={loading || !isConfirmationValid}
          >
            {loading ? 'Deleting...' : 'Delete Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
