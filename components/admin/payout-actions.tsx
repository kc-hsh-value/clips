'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, CreditCard, RotateCcw } from 'lucide-react';

interface PayoutActionsProps {
  payoutId: string;
  status: string;
}

export function PayoutActions({ payoutId, status }: PayoutActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const updateStatus = async (newStatus: 'pending' | 'processed' | 'paid') => {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('payouts')
      .update({ status: newStatus })
      .eq('id', payoutId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Payout marked as ${newStatus}`);
      router.refresh();
    }
    setLoading(false);
  };

  if (status === 'pending') {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateStatus('processed')}
          disabled={loading}
        >
          <Check className="h-4 w-4 mr-1" />
          Mark Processed
        </Button>
        <Button
          size="sm"
          onClick={() => updateStatus('paid')}
          disabled={loading}
        >
          <CreditCard className="h-4 w-4 mr-1" />
          Mark Paid
        </Button>
      </div>
    );
  }

  if (status === 'processed') {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => updateStatus('paid')}
          disabled={loading}
        >
          <CreditCard className="h-4 w-4 mr-1" />
          Mark Paid
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => updateStatus('pending')}
          disabled={loading}
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
      </div>
    );
  }

  if (status === 'paid') {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => updateStatus('pending')}
        disabled={loading}
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        Reset to Pending
      </Button>
    );
  }

  return null;
}
