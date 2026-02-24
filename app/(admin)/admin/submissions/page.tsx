import { createClient } from '@/lib/supabase/server';
import { SubmissionsPlatformBoard } from '@/components/admin/submissions-platform-board';

function getSingle<T>(relation: T | T[] | null | undefined): T | undefined {
  if (!relation) return undefined;
  return Array.isArray(relation) ? relation[0] : relation;
}

export default async function SubmissionsPage() {
  const supabase = await createClient();

  const { data: submissions } = await supabase
    .from('submissions_v2')
    .select(`
      id,
      url,
      views,
      status,
      submitted_at,
      profile:profiles(full_name, email),
      campaign:campaigns_v2!submissions_v2_campaign_id_fkey(name),
      campaign_platform:campaign_platforms_v2!submissions_v2_campaign_platform_id_fkey(platform)
    `)
    .order('created_at', { ascending: false });

  const normalizedSubmissions = (submissions || [])
    .map((submission) => {
      const profile = getSingle(submission.profile as { full_name?: string | null; email: string } | { full_name?: string | null; email: string }[]);
      const campaign = getSingle(submission.campaign as { name?: string | null } | { name?: string | null }[]);
      const campaignPlatform = getSingle(submission.campaign_platform as { platform?: 'x' | 'youtube' | 'tiktok' } | { platform?: 'x' | 'youtube' | 'tiktok' }[]);

      if (!campaignPlatform?.platform) return null;

      return {
        id: submission.id,
        url: submission.url,
        views: submission.views || 0,
        status: submission.status,
        submitted_at: submission.submitted_at,
        profile_name: profile?.full_name || profile?.email || 'Unknown',
        profile_email: profile?.email || 'Unknown',
        campaign_name: campaign?.name || 'Unknown campaign',
        platform: campaignPlatform.platform,
      };
    })
    .filter(Boolean) as {
      id: string;
      url: string;
      views: number;
      status: 'pending' | 'approved' | 'rejected';
      submitted_at: string;
      profile_name: string;
      profile_email: string;
      campaign_name: string;
      platform: 'x' | 'youtube' | 'tiktok';
    }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
        <p className="text-gray-600">Review and manage platform submissions</p>
      </div>

      <SubmissionsPlatformBoard submissions={normalizedSubmissions} />
    </div>
  );
}
