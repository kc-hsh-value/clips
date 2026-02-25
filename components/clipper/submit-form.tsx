'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, Send } from 'lucide-react';

import { isValidSubmissionUrl, type SubmissionPlatform } from '@/lib/submission-platform';

interface CampaignPlatformOption {
  id: string;
  platform: SubmissionPlatform;
  is_enabled: boolean;
  rate_per_1k: number;
  daily_submission_limit?: number;
}

interface CampaignOption {
  id: string;
  name: string;
  description: string | null;
  platforms: CampaignPlatformOption[];
}

interface SubmitClipFormProps {
  campaigns: CampaignOption[];
  submissionCountsByCampaignPlatform: Record<string, number>;
  dailyLimitByCampaignPlatform: Record<string, number>;
  preselectedCampaign?: string | null;
}

const PLATFORM_LABELS: Record<SubmissionPlatform, string> = {
  x: 'X',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
};

function SubmitClipFormInner({
  campaigns,
  submissionCountsByCampaignPlatform,
  dailyLimitByCampaignPlatform,
  preselectedCampaign,
}: SubmitClipFormProps) {
  const router = useRouter();

  const [campaignId, setCampaignId] = useState(preselectedCampaign || campaigns[0]?.id || '');
  const [campaignPlatformId, setCampaignPlatformId] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [urlValid, setUrlValid] = useState<boolean | null>(null);

  const getDailyLimit = (platform: CampaignPlatformOption) =>
    dailyLimitByCampaignPlatform[platform.id] ?? platform.daily_submission_limit ?? 1;

  const getTodayCount = (platform: CampaignPlatformOption) =>
    submissionCountsByCampaignPlatform[platform.id] || 0;

  const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId);

  const availablePlatforms = (selectedCampaign?.platforms || []).filter(
    (platform) => getTodayCount(platform) < getDailyLimit(platform)
  );

  const selectedPlatform = availablePlatforms.find((platform) => platform.id === campaignPlatformId);

  const availableCampaigns = campaigns.filter((campaign) => {
    const hasAvailablePlatform = campaign.platforms.some(
      (platform) => getTodayCount(platform) < getDailyLimit(platform)
    );
    return hasAvailablePlatform;
  });

  const handleCampaignChange = (value: string) => {
    setCampaignId(value);
    setCampaignPlatformId('');
    setSubmissionUrl('');
    setUrlValid(null);
  };

  const handlePlatformChange = (value: string) => {
    setCampaignPlatformId(value);
    setSubmissionUrl('');
    setUrlValid(null);
  };

  const handleUrlChange = (url: string) => {
    setSubmissionUrl(url);
    if (url.length > 0) {
      if (!selectedPlatform) {
        setUrlValid(false);
        return;
      }

      setUrlValid(isValidSubmissionUrl(selectedPlatform.platform, url));
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

    if (!campaignPlatformId || !selectedPlatform) {
      toast.error('Please select a platform');
      return;
    }

    if (!isValidSubmissionUrl(selectedPlatform.platform, submissionUrl)) {
      toast.error(`Please enter a valid ${PLATFORM_LABELS[selectedPlatform.platform]} URL`);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          campaignPlatformId,
          url: submissionUrl,
        }),
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
              : "You've reached your daily limits for all available campaign platforms today. Check back tomorrow!"}
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
          Submit per campaign platform (X / YouTube / TikTok / Instagram). Daily limits are configured per campaign platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="campaign">Campaign</Label>
            <Select value={campaignId} onValueChange={handleCampaignChange}>
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
            <Label htmlFor="platform">Platform</Label>
            <Select value={campaignPlatformId} onValueChange={handlePlatformChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a platform" />
              </SelectTrigger>
              <SelectContent>
                {availablePlatforms.map((platform) => (
                  <SelectItem key={platform.id} value={platform.id}>
                    {PLATFORM_LABELS[platform.platform]} • {`$${platform.rate_per_1k}/1K`} • {getTodayCount(platform)}/{getDailyLimit(platform)} used
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCampaign && availablePlatforms.length === 0 && (
              <p className="text-sm text-yellow-600">You have reached your daily limits for all platforms of this campaign today.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="submissionUrl">
              {selectedPlatform ? `${PLATFORM_LABELS[selectedPlatform.platform]} URL` : 'Submission URL'}
            </Label>
            <div className="relative">
              <Input
                id="submissionUrl"
                type="url"
                placeholder={
                  selectedPlatform?.platform === 'youtube'
                    ? 'https://youtube.com/watch?v=...'
                    : selectedPlatform?.platform === 'tiktok'
                    ? 'https://www.tiktok.com/@user/video/...'
                    : selectedPlatform?.platform === 'instagram'
                    ? 'https://www.instagram.com/reels/...'
                    : 'https://x.com/username/status/...'
                }
                value={submissionUrl}
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
              Enter the full URL for your selected platform
            </p>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !urlValid || !campaignPlatformId}>
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
