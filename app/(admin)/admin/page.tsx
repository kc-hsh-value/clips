import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Megaphone, 
  Users, 
  FileVideo, 
  Eye,
  DollarSign,
  Clock
} from 'lucide-react';
import { formatViews, formatCurrency } from '@/lib/payout';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function getPlatformValue(
  relation:
    | { platform?: string | null }
    | Array<{ platform?: string | null }>
    | null
    | undefined
) {
  if (Array.isArray(relation)) return relation[0]?.platform || undefined;
  return relation?.platform || undefined;
}

function getCampaignName(
  relation:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null
    | undefined
) {
  if (Array.isArray(relation)) return relation[0]?.name || undefined;
  return relation?.name || undefined;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  // Fetch stats
  const [
    { count: totalCampaigns },
    { count: activeCampaigns },
    { count: totalClippers },
    { count: pendingClippers },
    { count: totalSubmissions },
    { count: pendingSubmissions },
    { data: viewsData },
    { data: payoutsData },
  ] = await Promise.all([
    supabase.from('campaigns').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'clipper'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'clipper').eq('status', 'pending'),
    supabase.from('submissions_v2').select('*', { count: 'exact', head: true }),
    supabase.from('submissions_v2').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('submissions_v2')
      .select('views, campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform)')
      .eq('status', 'approved'),
    supabase.from('payouts').select('final_amount'),
  ]);

  const totalViews = viewsData?.reduce((acc, s) => acc + (s.views || 0), 0) || 0;
  const platformViews = (viewsData || []).reduce(
    (acc, s) => {
      const platform = getPlatformValue(s.campaign_platform);
      if (platform === 'x') acc.x += s.views || 0;
      if (platform === 'youtube') acc.youtube += s.views || 0;
      if (platform === 'tiktok') acc.tiktok += s.views || 0;
      return acc;
    },
    { x: 0, youtube: 0, tiktok: 0 }
  );
  const totalPayouts = payoutsData?.reduce((acc, p) => acc + (p.final_amount || 0), 0) || 0;

  // Recent submissions
  const { data: recentSubmissions } = await supabase
    .from('submissions_v2')
    .select(`
      *,
      profile:profiles(full_name, email),
      campaign:campaigns_v2!submissions_v2_campaign_id_fkey(name),
      campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform)
    `)
    .order('created_at', { ascending: false })
    .limit(5);

  const stats = [
    {
      title: 'Active Campaigns',
      value: activeCampaigns || 0,
      total: totalCampaigns || 0,
      icon: Megaphone,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Approved Clippers',
      value: (totalClippers || 0) - (pendingClippers || 0),
      total: totalClippers || 0,
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      pending: pendingClippers || 0,
    },
    {
      title: 'Total Submissions',
      value: totalSubmissions || 0,
      icon: FileVideo,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      pending: pendingSubmissions || 0,
    },
    {
      title: 'Total Views',
      value: formatViews(totalViews),
      icon: Eye,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      breakdown: `X ${formatViews(platformViews.x)} • YT ${formatViews(platformViews.youtube)} • TT ${formatViews(platformViews.tiktok)}`,
    },
    {
      title: 'Total Payouts',
      value: formatCurrency(totalPayouts),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
    {
      title: 'Pending Reviews',
      value: (pendingClippers || 0) + (pendingSubmissions || 0),
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600">Monitor your clipper campaigns and performance</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  {stat.total !== undefined && (
                    <p className="text-sm text-gray-500">of {stat.total} total</p>
                  )}
                  {stat.pending !== undefined && stat.pending > 0 && (
                    <p className="text-sm text-yellow-600">{stat.pending} pending</p>
                  )}
                  {'breakdown' in stat && stat.breakdown && (
                    <p className="text-xs text-gray-500 mt-1">{stat.breakdown}</p>
                  )}
                </div>
                <div className={`p-3 rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Submissions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Submissions</CardTitle>
          <Link href="/admin/submissions">
            <Button variant="outline" size="sm">View all</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentSubmissions && recentSubmissions.length > 0 ? (
            <div className="space-y-4">
              {recentSubmissions.map((submission) => (
                (() => {
                  const platform = getPlatformValue(submission.campaign_platform);
                  const campaignName = getCampaignName(submission.campaign);

                  return (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">
                      {submission.profile?.full_name || submission.profile?.email}
                    </p>
                    <p className="text-sm text-gray-600">
                      {campaignName} • {platform?.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatViews(submission.views)} views
                    </p>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        submission.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : submission.status === 'rejected'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {submission.status}
                    </span>
                  </div>
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
    </div>
  );
}
