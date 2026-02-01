import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatViews, formatCurrency, calculatePayout } from '@/lib/payout';
import { format } from 'date-fns';

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get clipper's payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select(`
      *,
      campaign:campaigns(name, rate_per_1k, multiplier_100k, multiplier_250k)
    `)
    .eq('clipper_id', user.id)
    .order('created_at', { ascending: false });

  // Get approved submissions for potential earnings
  const { data: submissions } = await supabase
    .from('submissions')
    .select(`
      *,
      campaign:campaigns(name, rate_per_1k, multiplier_100k, multiplier_250k, status)
    `)
    .eq('clipper_id', user.id)
    .eq('status', 'approved');

  // Calculate totals
  const totalPaid = payouts
    ?.filter((p) => p.status === 'paid')
    .reduce((acc, p) => acc + (p.final_amount || 0), 0) || 0;

  const totalPending = payouts
    ?.filter((p) => p.status !== 'paid')
    .reduce((acc, p) => acc + (p.final_amount || 0), 0) || 0;

  // Calculate potential earnings from active campaigns
  const activeSubmissions = submissions?.filter(
    (s) => s.campaign?.status === 'active'
  ) || [];
  
  let potentialEarnings = 0;
  activeSubmissions.forEach((s) => {
    if (s.campaign) {
      const payout = calculatePayout(
        s.views,
        s.campaign.rate_per_1k,
        s.campaign.multiplier_100k,
        s.campaign.multiplier_250k,
        s.campaign.max_payout_per_video
      );
      potentialEarnings += payout.cappedAmount;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Earnings</h1>
        <p className="text-gray-600">Track your earnings and payouts</p>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Total Paid</p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {formatCurrency(totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Pending Payout</p>
            <p className="text-3xl font-bold text-yellow-600 mt-1">
              {formatCurrency(totalPending)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-gray-600">Potential (Active)</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">
              {formatCurrency(potentialEarnings)}
            </p>
            <p className="text-xs text-gray-500 mt-1">From active campaigns</p>
          </CardContent>
        </Card>
      </div>

      {/* Payout History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
        </CardHeader>
        <CardContent>
          {payouts && payouts.length > 0 ? (
            <div className="space-y-4">
              {payouts.map((payout) => (
                <div
                  key={payout.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{payout.campaign?.name}</p>
                    <p className="text-sm text-gray-500">
                      {formatViews(payout.total_views)} views × {payout.multiplier}x
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{formatCurrency(payout.final_amount)}</p>
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
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No payouts yet</p>
          )}
        </CardContent>
      </Card>

      {/* Active Earnings Breakdown */}
      {activeSubmissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Campaign Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeSubmissions.map((submission) => {
                const payout = submission.campaign
                  ? calculatePayout(
                      submission.views,
                      submission.campaign.rate_per_1k,
                      submission.campaign.multiplier_100k,
                      submission.campaign.multiplier_250k,
                      submission.campaign.max_payout_per_video
                    )
                  : null;

                return (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-4 bg-blue-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{submission.campaign?.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatViews(submission.views)} views
                        {payout && payout.multiplier > 1 && (
                          <span className="text-green-600 ml-2">
                            × {payout.multiplier}x bonus!
                          </span>
                        )}
                        {payout && payout.wasCapped && (
                          <span className="text-orange-600 ml-2">
                            (capped)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-blue-600">
                        {payout ? formatCurrency(payout.finalAmount) : '-'}
                      </p>
                      <p className="text-xs text-gray-500">Potential</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout Info */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>• Base rate: $4 per 1,000 views</p>
          <p>• 100K+ views: 1.25x multiplier</p>
          <p>• 250K+ views: 1.5x multiplier</p>
          <p>• Payouts are calculated at the end of each campaign</p>
        </CardContent>
      </Card>
    </div>
  );
}
