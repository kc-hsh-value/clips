'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Download } from 'lucide-react';

export function ExportPayoutsButton() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: payouts } = await supabase
      .from('payouts')
      .select(`
        *,
        profile:profiles(full_name, email),
        campaign:campaigns(name)
      `)
      .order('created_at', { ascending: false });

    if (!payouts || payouts.length === 0) {
      toast.error('No payouts to export');
      setLoading(false);
      return;
    }

    // Generate CSV
    const headers = ['Clipper Name', 'Email', 'Campaign', 'Total Views', 'Base Amount', 'Multiplier', 'Final Amount', 'Status'];
    const rows = payouts.map((p) => [
      p.profile?.full_name || '',
      p.profile?.email || '',
      p.campaign?.name || '',
      p.total_views,
      p.base_amount,
      p.multiplier,
      p.final_amount,
      p.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payouts-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Payouts exported successfully');
    setLoading(false);
  };

  return (
    <Button variant="outline" onClick={handleExport} disabled={loading}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  );
}
