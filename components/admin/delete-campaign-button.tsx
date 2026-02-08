'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
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
  const router = useRouter();

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
      setOpen(false);
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Are you sure you want to delete <strong>{campaignName}</strong>?
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
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={deleteCampaign} 
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
