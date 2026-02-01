'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { EyeOff, Eye } from 'lucide-react';

interface HideCampaignButtonProps {
  campaignId: string;
  isHidden: boolean;
}

export function HideCampaignButton({ campaignId, isHidden }: HideCampaignButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggleHidden = async () => {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('campaigns')
      .update({ status: isHidden ? 'completed' : 'hidden' })
      .eq('id', campaignId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isHidden ? 'Campaign restored' : 'Campaign hidden');
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={toggleHidden}
      disabled={loading}
      title={isHidden ? 'Restore campaign' : 'Hide campaign'}
    >
      {isHidden ? (
        <>
          <Eye className="h-4 w-4 mr-1" />
          Restore
        </>
      ) : (
        <>
          <EyeOff className="h-4 w-4 mr-1" />
          Hide
        </>
      )}
    </Button>
  );
}
