'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, X } from 'lucide-react';
import { Profile } from '@/lib/types';

interface CampaignClippersManagerProps {
  campaignId: string;
}

export function CampaignClippersManager({ campaignId }: CampaignClippersManagerProps) {
  const [clippers, setClippers] = useState<(Profile & { joined_at: string })[]>([]);
  const [availableClippers, setAvailableClippers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchClippers();
  }, [campaignId]);

  const fetchClippers = async () => {
    const supabase = createClient();
    
    // Get clippers in this campaign
    const { data: campaignClippers } = await supabase
      .from('campaign_clippers')
      .select(`
        joined_at,
        profile:profiles(*)
      `)
      .eq('campaign_id', campaignId);

    if (campaignClippers) {
      setClippers(
        campaignClippers.map((cc) => ({
          ...(cc.profile as unknown as Profile),
          joined_at: cc.joined_at,
        }))
      );
    }

    // Get available clippers (approved but not in this campaign)
    const { data: allClippers } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'clipper')
      .eq('status', 'approved');

    if (allClippers && campaignClippers) {
      const assignedIds = campaignClippers.map((cc) => (cc.profile as unknown as Profile).id);
      setAvailableClippers(allClippers.filter((c) => !assignedIds.includes(c.id)));
    }
  };

  const addClipper = async (clipperId: string) => {
    setLoading(true);
    const supabase = createClient();
    
    const { error } = await supabase.from('campaign_clippers').insert({
      campaign_id: campaignId,
      clipper_id: clipperId,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Clipper added to campaign');
      fetchClippers();
    }
    setLoading(false);
  };

  const removeClipper = async (clipperId: string) => {
    setLoading(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('campaign_clippers')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('clipper_id', clipperId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Clipper removed from campaign');
      fetchClippers();
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Clippers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Clippers */}
        {clippers.length > 0 ? (
          <div className="space-y-2">
            {clippers.map((clipper) => (
              <div
                key={clipper.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{clipper.full_name || clipper.email}</p>
                  <p className="text-sm text-gray-500">{clipper.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeClipper(clipper.id)}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No clippers assigned</p>
        )}

        {/* Add Clipper */}
        {availableClippers.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Add Clippers</p>
            <div className="flex flex-wrap gap-2">
              {availableClippers.map((clipper) => (
                <Button
                  key={clipper.id}
                  variant="outline"
                  size="sm"
                  onClick={() => addClipper(clipper.id)}
                  disabled={loading}
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  {clipper.full_name || clipper.email}
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
