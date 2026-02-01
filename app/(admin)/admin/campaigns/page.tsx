import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Plus, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { HideCampaignButton } from '@/components/admin/hide-campaign-button';

interface CampaignWithCounts {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  rate_per_1k: number;
  status: string;
  campaign_clippers: { count: number }[];
  submissions: { count: number }[];
}

function CampaignCard({ campaign, showHideButton = true }: { campaign: CampaignWithCounts; showHideButton?: boolean }) {
  return (
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
                    : campaign.status === 'hidden'
                    ? 'outline'
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
          <div className="flex items-center gap-2">
            {showHideButton && (
              <HideCampaignButton 
                campaignId={campaign.id} 
                isHidden={campaign.status === 'hidden'} 
              />
            )}
            <Link href={`/admin/campaigns/${campaign.id}`}>
              <Button variant="outline">Manage</Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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

  const activeCampaigns = campaigns?.filter((c) => c.status === 'active') || [];
  const completedCampaigns = campaigns?.filter((c) => c.status === 'completed') || [];
  const hiddenCampaigns = campaigns?.filter((c) => c.status === 'hidden') || [];
  const draftCampaigns = campaigns?.filter((c) => c.status === 'draft') || [];

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

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">
            Active {activeCampaigns.length > 0 && `(${activeCampaigns.length})`}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Finished {completedCampaigns.length > 0 && `(${completedCampaigns.length})`}
          </TabsTrigger>
          <TabsTrigger value="hidden">
            Hidden {hiddenCampaigns.length > 0 && `(${hiddenCampaigns.length})`}
          </TabsTrigger>
          {draftCampaigns.length > 0 && (
            <TabsTrigger value="draft">
              Drafts ({draftCampaigns.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="grid gap-4">
            {activeCampaigns.length > 0 ? (
              activeCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500 mb-4">No active campaigns</p>
                  <Link href="/admin/campaigns/new">
                    <Button>Create a new campaign</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <div className="grid gap-4">
            {completedCampaigns.length > 0 ? (
              completedCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500">No finished campaigns yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="hidden" className="mt-4">
          <div className="grid gap-4">
            {hiddenCampaigns.length > 0 ? (
              hiddenCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <p className="text-gray-500">No hidden campaigns</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {draftCampaigns.length > 0 && (
          <TabsContent value="draft" className="mt-4">
            <div className="grid gap-4">
              {draftCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} showHideButton={false} />
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
