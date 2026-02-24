'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

interface SubmissionActionsProps {
  submissionId: string;
  status: string;
}

export function SubmissionActions({ submissionId, status }: SubmissionActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const updateStatus = async (newStatus: 'approved' | 'rejected') => {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('submissions_v2')
      .update({ 
        status: newStatus,
        approved_at: newStatus === 'approved' ? new Date().toISOString() : null
      })
      .eq('id', submissionId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Submission ${newStatus}`);
      router.refresh();
    }
    setLoading(false);
  };

  if (status !== 'pending') return null;

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => updateStatus('approved')}
        disabled={loading}
      >
        <Check className="h-4 w-4 mr-1" />
        Approve
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => updateStatus('rejected')}
        disabled={loading}
      >
        <X className="h-4 w-4 mr-1" />
        Reject
      </Button>
    </div>
  );
}
