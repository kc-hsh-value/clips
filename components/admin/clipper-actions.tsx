'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Check, X, RotateCcw, Shield } from 'lucide-react';

interface ClipperActionsProps {
  clipperId: string;
  status: string;
  isAdmin?: boolean;
}

export function ClipperActions({ clipperId, status, isAdmin = false }: ClipperActionsProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const toggleAdmin = async () => {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('profiles')
      .update({ role: isAdmin ? 'clipper' : 'admin' })
      .eq('id', clipperId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(isAdmin ? 'Admin access revoked' : 'Clipper promoted to admin');
      router.refresh();
    }
    setLoading(false);
  };

  const updateStatus = async (newStatus: 'approved' | 'rejected' | 'pending') => {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', clipperId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Clipper ${newStatus}`);
      router.refresh();
    }
    setLoading(false);
  };

  if (status === 'pending') {
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

  if (status === 'approved') {
    return (
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={isAdmin ? 'default' : 'outline'}
          onClick={toggleAdmin}
          disabled={loading}
          title={isAdmin ? 'Remove admin access' : 'Make admin'}
        >
          <Shield className="h-4 w-4 mr-1" />
          {isAdmin ? 'Remove Admin' : 'Make Admin'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => updateStatus('rejected')}
          disabled={loading}
        >
          Revoke Access
        </Button>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => updateStatus('approved')}
        disabled={loading}
      >
        <RotateCcw className="h-4 w-4 mr-1" />
        Restore
      </Button>
    );
  }

  return null;
}
