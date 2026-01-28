'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Send } from 'lucide-react';
import { isValidTweetUrl, extractTweetId } from '@/lib/twitter';

interface SubmitClipFormProps {
  campaigns: { id: string; name: string; description: string | null }[];
  submittedCampaignIds: string[];
  userId: string;
  preselectedCampaign?: string | null;
}

function SubmitClipFormInner({ campaigns, submittedCampaignIds, userId, preselectedCampaign }: SubmitClipFormProps) {
  const router = useRouter();

  const [campaignId, setCampaignId] = useState(preselectedCampaign || '');
  const [tweetUrl, setTweetUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlValid, setUrlValid] = useState<boolean | null>(null);

  const availableCampaigns = campaigns.filter(
    (c) => !submittedCampaignIds.includes(c.id)
  );

  const handleUrlChange = (url: string) => {
    setTweetUrl(url);
    if (url.length > 0) {
      setUrlValid(isValidTweetUrl(url));
    } else {
      setUrlValid(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!campaignId) {
      toast.error('Please select a campaign');
      return;
    }

    if (!isValidTweetUrl(tweetUrl)) {
      toast.error('Please enter a valid X (Twitter) URL');
      return;
    }

    const tweetId = extractTweetId(tweetUrl);
    if (!tweetId) {
      toast.error('Could not extract tweet ID from URL');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, tweetUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to submit clip');
        setLoading(false);
        return;
      }

      toast.success(`Clip submitted! Initial views: ${data.initialViews.toLocaleString()}`);
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to submit clip');
      setLoading(false);
    }
  };

  if (availableCampaigns.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No Campaigns Available</h3>
          <p className="text-gray-600">
            {campaigns.length === 0
              ? "You're not assigned to any active campaigns."
              : "You've already submitted clips for all available campaigns today. Check back tomorrow!"}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit Your Clip</CardTitle>
        <CardDescription>
          Submit the URL of your X (Twitter) post. You can submit 1 clip per campaign per day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a campaign" />
              </SelectTrigger>
              <SelectContent>
                {availableCampaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tweetUrl">X (Twitter) Post URL</Label>
            <div className="relative">
              <Input
                id="tweetUrl"
                type="url"
                placeholder="https://x.com/username/status/1234567890"
                value={tweetUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className={urlValid === false ? 'border-red-500' : urlValid === true ? 'border-green-500' : ''}
                required
              />
              {urlValid !== null && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {urlValid ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Enter the full URL of your clip post on X (Twitter)
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !urlValid}>
            <Send className="h-4 w-4 mr-2" />
            {loading ? 'Submitting...' : 'Submit Clip'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitFormWithParams(props: Omit<SubmitClipFormProps, 'preselectedCampaign'>) {
  const searchParams = useSearchParams();
  const preselectedCampaign = searchParams.get('campaign');
  return <SubmitClipFormInner {...props} preselectedCampaign={preselectedCampaign} />;
}

export function SubmitClipForm(props: Omit<SubmitClipFormProps, 'preselectedCampaign'>) {
  return (
    <Suspense fallback={<Card><CardContent className="p-8 text-center">Loading...</CardContent></Card>}>
      <SubmitFormWithParams {...props} />
    </Suspense>
  );
}
