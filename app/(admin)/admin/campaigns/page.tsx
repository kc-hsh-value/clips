import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default async function CampaignsPage() {
  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select(`
      *,
      campaign_clippers(count),
      submissions(count)
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-600">Manage your clipper campaigns</p>
        </div>
        <Link href="/admin/campaigns/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="grid gap-4">
        {campaigns && campaigns.length > 0 ? (
          campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
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
                    <div className="flex items-center gap-6 mt-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(campaign.start_date), 'MMM d')} -{' '}
                        {format(new Date(campaign.end_date), 'MMM d, yyyy')}
                      </span>
                      <span>
                        {campaign.campaign_clippers?.[0]?.count || 0} clippers
                      </span>
                      <span>
                        {campaign.submissions?.[0]?.count || 0} submissions
                      </span>
                      <span>${campaign.rate_per_1k}/1K views</span>
                    </div>
                  </div>
                  <Link href={`/admin/campaigns/${campaign.id}`}>
                    <Button variant="outline">Manage</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 mb-4">No campaigns yet</p>
              <Link href="/admin/campaigns/new">
                <Button>Create your first campaign</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
