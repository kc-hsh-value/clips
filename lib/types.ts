export type UserRole = 'admin' | 'clipper';
export type UserStatus = 'pending' | 'approved' | 'rejected';
export type CampaignStatus = 'draft' | 'active' | 'completed';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type PayoutStatus = 'pending' | 'processed' | 'paid';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  rate_per_1k: number;
  multiplier_100k: number;
  multiplier_250k: number;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
}

export interface CampaignClipper {
  id: string;
  campaign_id: string;
  clipper_id: string;
  joined_at: string;
  profile?: Profile;
  campaign?: Campaign;
}

export interface Submission {
  id: string;
  campaign_id: string;
  clipper_id: string;
  tweet_url: string;
  tweet_id: string;
  views: number;
  status: SubmissionStatus;
  submitted_at: string;
  approved_at: string | null;
  last_view_update: string | null;
  created_at: string;
  campaign?: Campaign;
  profile?: Profile;
}

export interface Payout {
  id: string;
  campaign_id: string;
  clipper_id: string;
  total_views: number;
  base_amount: number;
  multiplier: number;
  final_amount: number;
  status: PayoutStatus;
  created_at: string;
  processed_at: string | null;
  campaign?: Campaign;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  read: boolean;
  created_at: string;
}

// Utility types for API responses
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// Stats types
export interface DashboardStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalClippers: number;
  pendingClippers: number;
  totalSubmissions: number;
  pendingSubmissions: number;
  totalViews: number;
  totalPayouts: number;
}

export interface ClipperStats {
  totalSubmissions: number;
  approvedSubmissions: number;
  totalViews: number;
  totalEarnings: number;
  pendingEarnings: number;
}
