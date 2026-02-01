import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { formatViews, formatCurrency } from '@/lib/payout';
import { CampaignClippersManager } from '@/components/admin/campaign-clippers-manager';
import { CampaignSubmissions } from '@/components/admin/campaign-submissions';
import { RefreshViewsButton } from '@/components/admin/refresh-views-button';
import { ClipperLeaderboard } from '@/components/admin/clipper-leaderboard';

interface CampaignPageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single();

  if (!campaign) {
    notFound();
  }

  // Get campaign stats
  const { data: submissions } = await supabase
    .from('submissions')
    .select('views, status')
    .eq('campaign_id', id);

  const { count: clipperCount } = await supabase
    .from('campaign_clippers')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', id);

  const totalViews = submissions?.reduce((acc, s) => acc + (s.views || 0), 0) || 0;
  const approvedSubmissions = submissions?.filter((s) => s.status === 'approved').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <Badge
              variant={
                campaign.status === 'active'
                  ? 'default'
                  : campaign.status === 'completed'
                  ? 'secondary'
                  : 'outline'
              }
            >
              {campaign.status}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-gray-600 mt-1">{campaign.description}</p>
          )}
        </div>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Duration</p>
                <p className="font-medium">
                  {format(new Date(campaign.start_date), 'MMM d')} -{' '}
                  {format(new Date(campaign.end_date), 'MMM d')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Clippers</p>
                <p className="font-medium">{clipperCount || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Total Views</p>
                <p className="font-medium">{formatViews(totalViews)}</p>
              </div>
            </div>
            <div className="mt-2">
              <RefreshViewsButton campaignId={id} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div>
              <p className="text-sm text-gray-600">Submissions</p>
              <p className="font-medium">
                {approvedSubmissions} approved / {submissions?.length || 0} total
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-600">Rate per 1K views</p>
              <p className="text-lg font-semibold">{formatCurrency(campaign.rate_per_1k)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">100K+ Multiplier</p>
              <p className="text-lg font-semibold">{campaign.multiplier_100k}x</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">250K+ Multiplier</p>
              <p className="text-lg font-semibold">{campaign.multiplier_250k}x</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Max Payout Per Video</p>
              <p className="text-lg font-semibold">
                {campaign.max_payout_per_video 
                  ? formatCurrency(campaign.max_payout_per_video)
                  : 'No cap'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clipper Leaderboard */}
      <ClipperLeaderboard 
        campaignId={id}
        ratePerK={campaign.rate_per_1k}
        multiplier100k={campaign.multiplier_100k}
        multiplier250k={campaign.multiplier_250k}
        maxPayoutPerVideo={campaign.max_payout_per_video}
      />

      {/* Clippers Management */}
      <CampaignClippersManager campaignId={id} />

      {/* Submissions */}
      <CampaignSubmissions campaignId={id} />
    </div>
  );
}
