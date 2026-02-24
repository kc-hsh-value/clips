'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type Platform = 'x' | 'youtube' | 'tiktok';

interface PlatformConfig {
  rate_per_1k: string;
  multiplier_100k: string;
  multiplier_250k: string;
  max_payout_per_video: string;
}

const PLATFORM_OPTIONS: { value: Platform; label: string }[] = [
  { value: 'x', label: 'X' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
];

const defaultPlatformConfig = (): PlatformConfig => ({
  rate_per_1k: '4.00',
  multiplier_100k: '1.25',
  multiplier_250k: '1.50',
  max_payout_per_video: '',
});

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['x']);
  const [platformConfigs, setPlatformConfigs] = useState<Record<Platform, PlatformConfig>>({
    x: defaultPlatformConfig(),
    youtube: defaultPlatformConfig(),
    tiktok: defaultPlatformConfig(),
  });
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'draft' as 'draft' | 'active' | 'completed',
  });

  const togglePlatform = (platform: Platform, checked: boolean) => {
    if (checked) {
      if (!selectedPlatforms.includes(platform)) {
        setSelectedPlatforms((prev) => [...prev, platform]);
      }
      return;
    }

    setSelectedPlatforms((prev) => prev.filter((item) => item !== platform));
  };

  const updatePlatformConfig = (platform: Platform, key: keyof PlatformConfig, value: string) => {
    setPlatformConfigs((prev) => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [key]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (selectedPlatforms.length === 0) {
      toast.error('Select at least one platform');
      setLoading(false);
      return;
    }

    for (const platform of selectedPlatforms) {
      const config = platformConfigs[platform];
      const rate = parseFloat(config.rate_per_1k);
      const mult100k = parseFloat(config.multiplier_100k);
      const mult250k = parseFloat(config.multiplier_250k);

      if (Number.isNaN(rate) || Number.isNaN(mult100k) || Number.isNaN(mult250k)) {
        toast.error(`Invalid numeric values for ${platform.toUpperCase()}`);
        setLoading(false);
        return;
      }

      if (mult100k < 1 || mult250k < 1) {
        toast.error(`Multipliers must be at least 1.00 for ${platform.toUpperCase()}`);
        setLoading(false);
        return;
      }

      if (mult250k < mult100k) {
        toast.error(`250K+ multiplier cannot be lower than 100K+ for ${platform.toUpperCase()}`);
        setLoading(false);
        return;
      }
    }

    const supabase = createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    const legacyConfigSource = selectedPlatforms.includes('x')
      ? platformConfigs.x
      : platformConfigs[selectedPlatforms[0]];

    const { data: legacyCampaign, error: legacyError } = await supabase
      .from('campaigns')
      .insert({
      name: form.name,
      description: form.description || null,
      start_date: form.start_date,
      end_date: form.end_date,
      rate_per_1k: parseFloat(legacyConfigSource.rate_per_1k),
      multiplier_100k: parseFloat(legacyConfigSource.multiplier_100k),
      multiplier_250k: parseFloat(legacyConfigSource.multiplier_250k),
      max_payout_per_video: legacyConfigSource.max_payout_per_video
        ? parseFloat(legacyConfigSource.max_payout_per_video)
        : null,
      status: form.status,
      created_by: user?.id,
      })
      .select('id')
      .single();

    if (legacyError || !legacyCampaign) {
      toast.error(legacyError?.message || 'Failed to create campaign');
      setLoading(false);
      return;
    }

    const { data: campaignV2, error: campaignV2Error } = await supabase
      .from('campaigns_v2')
      .insert({
        legacy_campaign_id: legacyCampaign.id,
        name: form.name,
        description: form.description || null,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        created_by: user?.id,
      })
      .select('id')
      .single();

    if (campaignV2Error || !campaignV2) {
      await supabase.from('campaigns').delete().eq('id', legacyCampaign.id);
      toast.error(campaignV2Error?.message || 'Failed to create v2 campaign');
      setLoading(false);
      return;
    }

    const platformRows = selectedPlatforms.map((platform) => {
      const config = platformConfigs[platform];
      return {
        campaign_id: campaignV2.id,
        platform,
        rate_per_1k: parseFloat(config.rate_per_1k),
        multiplier_100k: parseFloat(config.multiplier_100k),
        multiplier_250k: parseFloat(config.multiplier_250k),
        max_payout_per_video: config.max_payout_per_video ? parseFloat(config.max_payout_per_video) : null,
        is_enabled: true,
      };
    });

    const { error: platformError } = await supabase
      .from('campaign_platforms_v2')
      .insert(platformRows);

    if (platformError) {
      await supabase.from('campaigns_v2').delete().eq('id', campaignV2.id);
      await supabase.from('campaigns').delete().eq('id', legacyCampaign.id);
      toast.error(platformError.message);
      setLoading(false);
      return;
    }

    toast.success('Campaign created successfully!');
    router.push('/admin/campaigns');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/campaigns">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Campaign</h1>
          <p className="text-gray-600">Create a new clipper campaign</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Week 1 - Product Launch"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Campaign details and guidelines..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Platforms</Label>
              <div className="grid grid-cols-3 gap-3">
                {PLATFORM_OPTIONS.map((platform) => (
                  <div key={platform.value} className="flex items-center gap-2 rounded-md border p-3">
                    <Checkbox
                      id={`platform-${platform.value}`}
                      checked={selectedPlatforms.includes(platform.value)}
                      onCheckedChange={(checked) => togglePlatform(platform.value, Boolean(checked))}
                    />
                    <Label htmlFor={`platform-${platform.value}`}>{platform.label}</Label>
                  </div>
                ))}
              </div>
            </div>

            {selectedPlatforms.map((platform) => {
              const config = platformConfigs[platform];
              const label = PLATFORM_OPTIONS.find((item) => item.value === platform)?.label || platform;

              return (
                <Card key={platform}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{label} Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${platform}-rate`}>Rate per 1K views ($)</Label>
                        <Input
                          id={`${platform}-rate`}
                          type="number"
                          step="0.01"
                          min="0"
                          value={config.rate_per_1k}
                          onChange={(e) => updatePlatformConfig(platform, 'rate_per_1k', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${platform}-mult100k`}>100K+ Multiplier</Label>
                        <Input
                          id={`${platform}-mult100k`}
                          type="number"
                          step="0.01"
                          min="1"
                          value={config.multiplier_100k}
                          onChange={(e) => updatePlatformConfig(platform, 'multiplier_100k', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${platform}-mult250k`}>250K+ Multiplier</Label>
                        <Input
                          id={`${platform}-mult250k`}
                          type="number"
                          step="0.01"
                          min="1"
                          value={config.multiplier_250k}
                          onChange={(e) => updatePlatformConfig(platform, 'multiplier_250k', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${platform}-max-payout`}>Max Payout Per Video ($)</Label>
                      <Input
                        id={`${platform}-max-payout`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={config.max_payout_per_video}
                        onChange={(e) => updatePlatformConfig(platform, 'max_payout_per_video', e.target.value)}
                        placeholder="Leave empty for no cap"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) => setForm({ ...form, status: value as typeof form.status })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Campaign'}
              </Button>
              <Link href="/admin/campaigns">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
