'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, ExternalLink } from 'lucide-react';
import { formatViews } from '@/lib/payout';
import { formatDistanceToNow } from 'date-fns';

interface CampaignSubmissionsProps {
  campaignId: string;
}

interface SubmissionV2 {
  id: string;
  url: string;
  views: number;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
  approved_at: string | null;
  profile?: { full_name?: string | null; email: string } | { full_name?: string | null; email: string }[];
  campaign_platform?: { platform?: string | null } | { platform?: string | null }[];
}

function getPlatformValue(relation: SubmissionV2['campaign_platform']) {
  if (Array.isArray(relation)) return relation[0]?.platform || undefined;
  return relation?.platform || undefined;
}

function getProfileValue(relation: SubmissionV2['profile']) {
  if (Array.isArray(relation)) return relation[0];
  return relation;
}

export function CampaignSubmissions({ campaignId }: CampaignSubmissionsProps) {
  const [submissions, setSubmissions] = useState<SubmissionV2[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [campaignId]);

  const fetchSubmissions = async () => {
    const supabase = createClient();
    
    const { data } = await supabase
      .from('submissions_v2')
      .select(`
        id,
        url,
        views,
        status,
        submitted_at,
        approved_at,
        profile:profiles(full_name, email),
        campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (data) {
      setSubmissions(data as unknown as SubmissionV2[]);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('submissions_v2')
      .update({ 
        status, 
        approved_at: status === 'approved' ? new Date().toISOString() : null 
      })
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Submission ${status}`);
      fetchSubmissions();
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submissions</CardTitle>
      </CardHeader>
      <CardContent>
        {submissions.length > 0 ? (
          <div className="space-y-4">
            {submissions.map((submission) => (
              (() => {
                const profile = getProfileValue(submission.profile);
                const platform = getPlatformValue(submission.campaign_platform);

                return (
              <div
                key={submission.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">
                      {profile?.full_name || profile?.email}
                    </p>
                    <Badge variant="outline" className="uppercase">
                      {platform || 'unknown'}
                    </Badge>
                    <Badge
                      variant={
                        submission.status === 'approved'
                          ? 'default'
                          : submission.status === 'rejected'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {submission.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span>{formatViews(submission.views)} views</span>
                    <span>
                      {formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}
                    </span>
                    <a
                      href={submission.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View submission <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                {submission.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateStatus(submission.id, 'approved')}
                      disabled={loading}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateStatus(submission.id, 'rejected')}
                      disabled={loading}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
                );
              })()
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No submissions yet</p>
        )}
      </CardContent>
    </Card>
  );
}
