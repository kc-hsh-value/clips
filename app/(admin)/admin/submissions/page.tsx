import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, ExternalLink } from 'lucide-react';
import { formatViews } from '@/lib/payout';
import { formatDistanceToNow } from 'date-fns';
import { SubmissionActions } from '@/components/admin/submission-actions';

export default async function SubmissionsPage() {
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      *,
      profile:profiles(full_name, email),
      campaign:campaigns(name)
    `)
    .order('created_at', { ascending: false });

  const pendingSubmissions = submissions?.filter((s) => s.status === 'pending') || [];
  const approvedSubmissions = submissions?.filter((s) => s.status === 'approved') || [];
  const rejectedSubmissions = submissions?.filter((s) => s.status === 'rejected') || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
        <p className="text-gray-600">Review and manage clip submissions</p>
      </div>

      {/* Pending Submissions */}
      {pendingSubmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pending Review
              <Badge variant="secondary">{pendingSubmissions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {submission.profile?.full_name || submission.profile?.email}
                      </p>
                      <span className="text-gray-400">•</span>
                      <p className="text-sm text-gray-600">{submission.campaign?.name}</p>
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
                  <SubmissionActions submissionId={submission.id} status={submission.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approved Submissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Approved
            <Badge>{approvedSubmissions.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedSubmissions.length > 0 ? (
            <div className="space-y-4">
              {approvedSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 bg-green-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {submission.profile?.full_name || submission.profile?.email}
                      </p>
                      <span className="text-gray-400">•</span>
                      <p className="text-sm text-gray-600">{submission.campaign?.name}</p>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span className="font-medium text-green-700">
                        {formatViews(submission.views)} views
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
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No approved submissions yet</p>
          )}
        </CardContent>
      </Card>

      {/* Rejected Submissions */}
      {rejectedSubmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Rejected
              <Badge variant="destructive">{rejectedSubmissions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rejectedSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg opacity-60"
                >
                  <div>
                    <p className="font-medium">
                      {submission.profile?.full_name || submission.profile?.email}
                    </p>
                    <p className="text-sm text-gray-600">{submission.campaign?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
