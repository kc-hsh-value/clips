import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowLeft, Calendar, Eye, FileVideo, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatViews, calculatePayout } from '@/lib/payout';

interface ClipperDetailsPageProps {
  params: Promise<{ id: string }>;
}

interface SubmissionRow {
  id: string;
  url: string;
  views: number;
  submitted_at: string;
  campaign?: { name?: string | null } | { name?: string | null }[];
  campaign_platform?: {
    platform?: 'x' | 'youtube' | 'tiktok';
    rate_per_1k?: number;
    multiplier_100k?: number;
    multiplier_250k?: number;
    max_payout_per_video?: number | null;
  } | {
    platform?: 'x' | 'youtube' | 'tiktok';
    rate_per_1k?: number;
    multiplier_100k?: number;
    multiplier_250k?: number;
    max_payout_per_video?: number | null;
  }[];
}

function getSingle<T>(relation: T | T[] | null | undefined): T | undefined {
  if (!relation) return undefined;
  return Array.isArray(relation) ? relation[0] : relation;
}

function summarizeByWindow(submissions: SubmissionRow[], days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return submissions
    .filter((submission) => new Date(submission.submitted_at) >= since)
    .reduce(
      (acc, submission) => {
        const config = getSingle(submission.campaign_platform);
        const payout = calculatePayout(
          submission.views || 0,
          config?.rate_per_1k ?? 4,
          config?.multiplier_100k ?? 1.25,
          config?.multiplier_250k ?? 1.5,
          config?.max_payout_per_video ?? null
        );

        acc.submissions += 1;
        acc.views += submission.views || 0;
        acc.earnings += payout.cappedAmount;
        return acc;
      },
      { submissions: 0, views: 0, earnings: 0 }
    );
}

export default async function ClipperDetailsPage({ params }: ClipperDetailsPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: clipper } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .eq('role', 'clipper')
    .single();

  if (!clipper) {
    notFound();
  }

  if (clipper.status !== 'approved') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/clippers">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{clipper.full_name || clipper.email}</h1>
            <p className="text-gray-600">Clipper profile</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <p className="text-gray-700">
              Detailed performance stats are available only for approved clippers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: submissionsData } = await supabase
    .from('submissions_v2')
    .select(`
      id,
      url,
      views,
      submitted_at,
      campaign:campaigns_v2!submissions_v2_campaign_id_fkey(name),
      campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(
        platform,
        rate_per_1k,
        multiplier_100k,
        multiplier_250k,
        max_payout_per_video
      )
    `)
    .eq('clipper_id', id)
    .eq('status', 'approved')
    .order('views', { ascending: false });

  const { data: campaignsData } = await supabase
    .from('campaign_clippers_v2')
    .select(`
      joined_at,
      campaign:campaigns_v2!campaign_clippers_v2_campaign_id_fkey(name, status, start_date, end_date)
    `)
    .eq('clipper_id', id)
    .order('joined_at', { ascending: false });

  const submissions = (submissionsData || []) as SubmissionRow[];
  const campaignsParticipated = campaignsData || [];

  const totals = summarizeByWindow(submissions, 3650);
  const dayStats = summarizeByWindow(submissions, 1);
  const weekStats = summarizeByWindow(submissions, 7);
  const monthStats = summarizeByWindow(submissions, 30);

  const bestByPlatform: Record<'x' | 'youtube' | 'tiktok', SubmissionRow[]> = {
    x: [],
    youtube: [],
    tiktok: [],
  };

  for (const submission of submissions) {
    const platform = getSingle(submission.campaign_platform)?.platform;
    if (!platform || !bestByPlatform[platform]) continue;
    if (bestByPlatform[platform].length < 3) {
      bestByPlatform[platform].push(submission);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/clippers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{clipper.full_name || clipper.email}</h1>
          <p className="text-gray-600">{clipper.email}</p>
        </div>
        <Badge>{clipper.status}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Joined</p>
            <p className="font-semibold">{format(new Date(clipper.created_at), 'MMM d, yyyy')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Campaigns Participated</p>
            <p className="font-semibold">{campaignsParticipated.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Approved Submissions</p>
            <p className="font-semibold">{totals.submissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total Views</p>
            <p className="font-semibold">{formatViews(totals.views)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Performance Windows</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Last 24h', icon: Calendar, stats: dayStats },
              { label: 'Last 7 days', icon: Eye, stats: weekStats },
              { label: 'Last 30 days', icon: Trophy, stats: monthStats },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-4">
                <p className="text-sm text-gray-600 mb-2">{item.label}</p>
                <div className="space-y-1 text-sm">
                  <p>{item.stats.submissions} submissions</p>
                  <p>{formatViews(item.stats.views)} views</p>
                  <p>{formatCurrency(item.stats.earnings)} est. earnings</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns Participated</CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsParticipated.length > 0 ? (
            <div className="space-y-3">
              {campaignsParticipated.map((entry, index) => {
                const campaign = getSingle(entry.campaign as { name?: string; status?: string; start_date?: string; end_date?: string } | { name?: string; status?: string; start_date?: string; end_date?: string }[]);
                return (
                  <div key={`${campaign?.name || 'campaign'}-${index}`} className="rounded-lg border p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{campaign?.name}</p>
                      <p className="text-sm text-gray-500">
                        {campaign?.start_date ? format(new Date(campaign.start_date), 'MMM d, yyyy') : '-'}
                        {' - '}
                        {campaign?.end_date ? format(new Date(campaign.end_date), 'MMM d, yyyy') : '-'}
                      </p>
                    </div>
                    <Badge variant="outline">{campaign?.status || 'unknown'}</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500">No campaign participation yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Best Submissions by Platform</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['x', 'youtube', 'tiktok'] as const).map((platform) => (
              <div key={platform} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold uppercase">{platform}</p>
                  <Badge variant="outline">Top {bestByPlatform[platform].length}</Badge>
                </div>

                {bestByPlatform[platform].length > 0 ? (
                  bestByPlatform[platform].map((submission, index) => {
                    const campaign = getSingle(submission.campaign);
                    return (
                      <a
                        key={submission.id}
                        href={submission.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-md border p-3 hover:bg-gray-50"
                      >
                        <p className="text-sm font-medium">#{index + 1} • {formatViews(submission.views)}</p>
                        <p className="text-xs text-gray-500 mt-1">{campaign?.name || 'Unknown campaign'}</p>
                        <p className="text-xs text-gray-500">{format(new Date(submission.submitted_at), 'MMM d, yyyy')}</p>
                      </a>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">No approved submissions</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lifetime Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">Total submissions</p>
              <p className="text-xl font-semibold">{totals.submissions}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">Total views</p>
              <p className="text-xl font-semibold">{formatViews(totals.views)}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-gray-600">Estimated earnings</p>
              <p className="text-xl font-semibold text-green-600">{formatCurrency(totals.earnings)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
