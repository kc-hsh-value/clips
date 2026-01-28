'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface RefreshViewsButtonProps {
  campaignId: string;
}

export function RefreshViewsButton({ campaignId }: RefreshViewsButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRefresh = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/admin/campaigns/${campaignId}/refresh-views`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to refresh views');
        return;
      }

      toast.success(`Views updated! ${data.updated}/${data.total} submissions refreshed.`);
      
      // Refresh the page to show updated data
      router.refresh();
    } catch (error) {
      toast.error('Failed to refresh views');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleRefresh} 
      disabled={loading}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Refreshing...' : 'Refresh Views'}
    </Button>
  );
}
