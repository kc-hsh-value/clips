'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    rate_per_1k: '4.00',
    multiplier_100k: '1.25',
    multiplier_250k: '1.50',
    status: 'draft' as 'draft' | 'active' | 'completed',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.from('campaigns').insert({
      name: form.name,
      description: form.description || null,
      start_date: form.start_date,
      end_date: form.end_date,
      rate_per_1k: parseFloat(form.rate_per_1k),
      multiplier_100k: parseFloat(form.multiplier_100k),
      multiplier_250k: parseFloat(form.multiplier_250k),
      status: form.status,
    });

    if (error) {
      toast.error(error.message);
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

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rate">Rate per 1K views ($)</Label>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  value={form.rate_per_1k}
                  onChange={(e) => setForm({ ...form, rate_per_1k: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mult100k">100K+ Multiplier</Label>
                <Input
                  id="mult100k"
                  type="number"
                  step="0.01"
                  value={form.multiplier_100k}
                  onChange={(e) => setForm({ ...form, multiplier_100k: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mult250k">250K+ Multiplier</Label>
                <Input
                  id="mult250k"
                  type="number"
                  step="0.01"
                  value={form.multiplier_250k}
                  onChange={(e) => setForm({ ...form, multiplier_250k: e.target.value })}
                  required
                />
              </div>
            </div>

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
