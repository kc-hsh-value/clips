'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatViews } from '@/lib/payout';
import { SubmissionActions } from '@/components/admin/submission-actions';

type Platform = 'x' | 'youtube' | 'tiktok' | 'instagram';
type Status = 'pending' | 'approved' | 'rejected';
type SortBy = 'newest' | 'oldest' | 'views_desc' | 'views_asc';
type Scope = 'all' | 'pending' | 'old';

interface SubmissionItem {
  id: string;
  url: string;
  views: number;
  status: Status;
  submitted_at: string;
  profile_name: string;
  profile_email: string;
  campaign_name: string;
  platform: Platform;
}

interface SubmissionsPlatformBoardProps {
  submissions: SubmissionItem[];
}

const PLATFORMS: Platform[] = ['x', 'youtube', 'tiktok', 'instagram'];

const PLATFORM_LABELS: Record<Platform, string> = {
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

function sortSubmissions(list: SubmissionItem[], sortBy: SortBy) {
  return [...list].sort((a, b) => {
    if (sortBy === 'newest') return +new Date(b.submitted_at) - +new Date(a.submitted_at);
    if (sortBy === 'oldest') return +new Date(a.submitted_at) - +new Date(b.submitted_at);
    if (sortBy === 'views_desc') return (b.views || 0) - (a.views || 0);
    return (a.views || 0) - (b.views || 0);
  });
}

function SubmissionRow({ submission }: { submission: SubmissionItem }) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{submission.profile_name || submission.profile_email}</p>
          <span className="text-gray-400">•</span>
          <p className="text-sm text-gray-600">{submission.campaign_name}</p>
          <Badge variant="outline" className="uppercase">
            {submission.platform}
          </Badge>
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
          <span>{formatViews(submission.views)} views</span>
          <span>{formatDistanceToNow(new Date(submission.submitted_at), { addSuffix: true })}</span>
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
      {submission.status === 'pending' ? (
        <SubmissionActions submissionId={submission.id} status={submission.status} />
      ) : (
        <Badge
          variant={submission.status === 'approved' ? 'default' : 'destructive'}
          className="capitalize"
        >
          {submission.status}
        </Badge>
      )}
    </div>
  );
}

export function SubmissionsPlatformBoard({ submissions }: SubmissionsPlatformBoardProps) {
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [scope, setScope] = useState<Scope>('all');

  const countsByPlatform = useMemo(() => {
    return PLATFORMS.reduce<Record<Platform, number>>(
      (acc, platform) => {
        acc[platform] = submissions.filter((submission) => submission.platform === platform).length;
        return acc;
      },
      { x: 0, youtube: 0, tiktok: 0, instagram: 0 }
    );
  }, [submissions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All submissions</SelectItem>
            <SelectItem value="pending">Pending only</SelectItem>
            <SelectItem value="old">Old (approved + rejected)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Chronological (newest first)</SelectItem>
            <SelectItem value="oldest">Chronological (oldest first)</SelectItem>
            <SelectItem value="views_desc">Views (high to low)</SelectItem>
            <SelectItem value="views_asc">Views (low to high)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue={PLATFORMS[0]} className="w-full">
        <TabsList>
          {PLATFORMS.map((platform) => (
            <TabsTrigger key={platform} value={platform}>
              {PLATFORM_LABELS[platform]} {countsByPlatform[platform] > 0 ? `(${countsByPlatform[platform]})` : ''}
            </TabsTrigger>
          ))}
        </TabsList>

        {PLATFORMS.map((platform) => {
          const platformSubmissions = submissions.filter((submission) => submission.platform === platform);

          const pending = platformSubmissions.filter((submission) => submission.status === 'pending');
          const old = platformSubmissions.filter((submission) => submission.status !== 'pending');

          const pendingSorted = sortSubmissions(pending, sortBy);
          const oldSorted = sortSubmissions(old, sortBy);

          const showPending = scope !== 'old';
          const showOld = scope !== 'pending';

          return (
            <TabsContent key={platform} value={platform} className="mt-4 space-y-4">
              {platformSubmissions.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <p className="text-gray-500">No submissions on {PLATFORM_LABELS[platform]} yet</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {showPending && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          Pending Review
                          <Badge variant="secondary">{pending.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {pendingSorted.length > 0 ? (
                          <div className="space-y-4">
                            {pendingSorted.map((submission) => (
                              <SubmissionRow key={submission.id} submission={submission} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">No pending submissions in this platform</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {showOld && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          Previous Submissions
                          <Badge>{old.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {oldSorted.length > 0 ? (
                          <div className="space-y-4">
                            {oldSorted.map((submission) => (
                              <SubmissionRow key={submission.id} submission={submission} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500">No previous submissions in this platform</p>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
