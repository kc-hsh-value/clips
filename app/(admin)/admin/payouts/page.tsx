import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatViews, calculatePayout } from '@/lib/payout';
import { format } from 'date-fns';
import { ExportPayoutsButton } from '@/components/admin/export-payouts-button';
import { GeneratePayoutsButton } from '@/components/admin/generate-payouts-button';

export default async function PayoutsPage() {
  const supabase = await createClient();

  // Get all campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  // Get existing payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select(`
      *,
      profile:profiles(full_name, email),
      campaign:campaigns(name)
    `)
    .order('created_at', { ascending: false });

  // Calculate pending payouts for completed campaigns
  const completedCampaigns = campaigns?.filter((c) => c.status === 'completed') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payouts</h1>
          <p className="text-gray-600">Manage clipper payouts and exports</p>
        </div>
        <div className="flex gap-2">
          <GeneratePayoutsButton campaigns={completedCampaigns} />
          <ExportPayoutsButton />
        </div>
      </div>

      {/* Payout Summary by Campaign */}
      <Card>
        <CardHeader>
          <CardTitle>Campaign Payouts</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts && payouts.length > 0 ? (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {payout.profile?.full_name || payout.profile?.email}
                      </p>
                      <Badge
                        variant={
                          payout.status === 'paid'
                            ? 'default'
                            : payout.status === 'processed'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {payout.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{payout.campaign?.name}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <span>{formatViews(payout.total_views)} views</span>
                      <span>×{payout.multiplier} multiplier</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(payout.final_amount)}
                    </p>
                    <p className="text-sm text-gray-500">
                      Base: {formatCurrency(payout.base_amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No payouts yet. Generate payouts for completed campaigns.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
