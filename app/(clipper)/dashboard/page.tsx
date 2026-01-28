import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Eye, DollarSign, FileVideo, TrendingUp } from 'lucide-react';
import { formatViews, formatCurrency, calculatePayout } from '@/lib/payout';
import { format } from 'date-fns';
import { Campaign } from '@/lib/types';

export default async function ClipperDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get clipper's campaigns
  const { data: campaignClippers } = await supabase
    .from('campaign_clippers')
    .select(`
      campaign:campaigns(*)
    `)
    .eq('clipper_id', user.id);

  const campaigns = (campaignClippers?.map((cc) => cc.campaign).filter(Boolean).flat() || []) as unknown as Campaign[];
  const activeCampaigns = campaigns.filter((c) => c?.status === 'active');

  // Get clipper's submissions
  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      *,
      campaign:campaigns(name)
    `)
    .eq('clipper_id', user.id)
    .order('created_at', { ascending: false });

  // Get clipper's payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select('*')
    .eq('clipper_id', user.id);

  // Calculate stats
  const totalViews = submissions?.reduce((acc, s) => acc + (s.views || 0), 0) || 0;
  const approvedSubmissions = submissions?.filter((s) => s.status === 'approved') || [];
  const totalEarnings = payouts?.reduce((acc, p) => acc + (p.final_amount || 0), 0) || 0;

  const stats = [
    {
      title: 'Total Views',
      value: formatViews(totalViews),
      icon: Eye,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Approved Clips',
      value: approvedSubmissions.length,
      icon: FileVideo,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Total Earnings',
      value: formatCurrency(totalEarnings),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Active Campaigns',
      value: activeCampaigns.length,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Track your performance and earnings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Campaigns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Active Campaigns</CardTitle>
          <Link href="/dashboard/submit">
            <Button>Submit Clip</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {activeCampaigns.length > 0 ? (
            <div className="space-y-4">
              {activeCampaigns.map((campaign) => {
                // Count submissions for this campaign today
                const today = new Date().toISOString().split('T')[0];
                const todaySubmissions = submissions?.filter(
                  (s) =>
                    s.campaign_id === campaign?.id &&
                    s.submitted_at.split('T')[0] === today
                ).length || 0;

                return (
                  <div
                    key={campaign?.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <h3 className="font-medium">{campaign?.name}</h3>
                      <p className="text-sm text-gray-600">
                        {format(new Date(campaign?.start_date || ''), 'MMM d')} -{' '}
                        {format(new Date(campaign?.end_date || ''), 'MMM d, yyyy')}
                      </p>
                      <p className="text-sm text-gray-500">
                        ${campaign?.rate_per_1k}/1K views
                      </p>
                    </div>
                    <div className="text-right">
                      {todaySubmissions > 0 ? (
                        <Badge variant="secondary">Submitted today</Badge>
                      ) : (
                        <Link href={`/dashboard/submit?campaign=${campaign?.id}`}>
                          <Button size="sm">Submit Clip</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              You&apos;re not assigned to any active campaigns yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissions && submissions.length > 0 ? (
            <div className="space-y-4">
              {submissions.slice(0, 5).map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{submission.campaign?.name}</p>
                    <p className="text-sm text-gray-500">
                      {format(new Date(submission.submitted_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatViews(submission.views)} views</p>
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
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No submissions yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
