'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X, ExternalLink } from 'lucide-react';
import { Submission } from '@/lib/types';
import { formatViews } from '@/lib/payout';
import { formatDistanceToNow } from 'date-fns';

interface CampaignSubmissionsProps {
  campaignId: string;
}

export function CampaignSubmissions({ campaignId }: CampaignSubmissionsProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, [campaignId]);

  const fetchSubmissions = async () => {
    const supabase = createClient();
    
    const { data } = await supabase
      .from('submissions')
      .select(`
        *,
        profile:profiles(full_name, email)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (data) {
      setSubmissions(data as unknown as Submission[]);
    }
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setLoading(true);
    const supabase = createClient();
    
    const { error } = await supabase
      .from('submissions')
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
              <div
                key={submission.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <p className="font-medium">
                      {(submission.profile as { full_name?: string; email: string })?.full_name || 
                       (submission.profile as { email: string })?.email}
                    </p>
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
                      href={submission.tweet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View tweet <ExternalLink className="h-3 w-3" />
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
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No submissions yet</p>
        )}
      </CardContent>
    </Card>
  );
}
