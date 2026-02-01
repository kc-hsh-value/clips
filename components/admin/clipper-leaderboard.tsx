'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatViews, formatCurrency, calculatePayout } from '@/lib/payout';
import { Trophy, Medal, Award } from 'lucide-react';

interface ClipperStats {
  clipper_id: string;
  clipper_name: string;
  clipper_email: string;
  total_views: number;
  submission_count: number;
  estimated_earnings: number;
}

interface ClipperLeaderboardProps {
  campaignId: string;
  ratePerK: number;
  multiplier100k: number;
  multiplier250k: number;
  maxPayoutPerVideo: number | null;
}

export function ClipperLeaderboard({ 
  campaignId, 
  ratePerK, 
  multiplier100k, 
  multiplier250k,
  maxPayoutPerVideo 
}: ClipperLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<ClipperStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const supabase = createClient();

      // Get all approved submissions for this campaign with clipper info
      const { data: submissions } = await supabase
        .from('submissions')
        .select(`
          views,
          clipper_id,
          clipper:profiles!clipper_id(id, name, email)
        `)
        .eq('campaign_id', campaignId)
        .eq('status', 'approved');

      if (!submissions) {
        setLoading(false);
        return;
      }

      // Aggregate by clipper
      const clipperMap = new Map<string, ClipperStats>();

      for (const sub of submissions) {
        const clipper = sub.clipper as unknown as { id: string; name: string; email: string };
        if (!clipper) continue;

        const existing = clipperMap.get(clipper.id);
        const views = sub.views || 0;
        
        // Calculate earnings for this submission
        const payout = calculatePayout(views, ratePerK, multiplier100k, multiplier250k, maxPayoutPerVideo);
        const earnings = payout.cappedAmount;

        if (existing) {
          existing.total_views += views;
          existing.submission_count += 1;
          existing.estimated_earnings += earnings;
        } else {
          clipperMap.set(clipper.id, {
            clipper_id: clipper.id,
            clipper_name: clipper.name || 'Unknown',
            clipper_email: clipper.email,
            total_views: views,
            submission_count: 1,
            estimated_earnings: earnings,
          });
        }
      }

      // Sort by total views descending
      const sorted = Array.from(clipperMap.values()).sort(
        (a, b) => b.total_views - a.total_views
      );

      setLeaderboard(sorted);
      setLoading(false);
    }

    fetchLeaderboard();
  }, [campaignId, ratePerK, multiplier100k, multiplier250k, maxPayoutPerVideo]);

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (index === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (index === 2) return <Award className="h-5 w-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-medium text-gray-500">{index + 1}</span>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clipper Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Clipper Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">No approved submissions yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Clipper Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaderboard.map((clipper, index) => (
            <div
              key={clipper.clipper_id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                index === 0 ? 'bg-yellow-50 border border-yellow-200' :
                index === 1 ? 'bg-gray-50 border border-gray-200' :
                index === 2 ? 'bg-amber-50 border border-amber-200' :
                'bg-white border border-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                {getRankIcon(index)}
                <div>
                  <p className="font-medium">{clipper.clipper_name}</p>
                  <p className="text-sm text-gray-500">{clipper.clipper_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-semibold">{formatViews(clipper.total_views)}</p>
                  <p className="text-xs text-gray-500">views</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{clipper.submission_count} clips</Badge>
                </div>
                <div className="text-right min-w-[80px]">
                  <p className="font-semibold text-green-600">{formatCurrency(clipper.estimated_earnings)}</p>
                  <p className="text-xs text-gray-500">est. earnings</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
