# Clipper Campaign Management Dashboard - Implementation Plan

## Overview
A web-based dashboard to manage weekly clipper marketing campaigns. Clippers submit X (Twitter) clips and get paid based on views ($4/1K views with multipliers).

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **API**: twitterapi.io (for fetching tweet view counts)
- **UI**: ShadcnUI + Tailwind CSS
- **Deployment**: Vercel (later)

---

## Database Schema (Supabase)

### Tables

```sql
-- Users (extended from Supabase auth.users)
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'clipper' CHECK (role IN ('admin', 'clipper')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Campaigns
campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  rate_per_1k DECIMAL DEFAULT 4.00,
  multiplier_100k DECIMAL DEFAULT 1.25,
  multiplier_250k DECIMAL DEFAULT 1.50,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Campaign Clippers (many-to-many)
campaign_clippers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  clipper_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, clipper_id)
)

-- Submissions
submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  clipper_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tweet_url TEXT NOT NULL,
  tweet_id TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  last_view_update TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Payouts
payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  clipper_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  base_amount DECIMAL DEFAULT 0,
  multiplier DECIMAL DEFAULT 1.0,
  final_amount DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
)

-- Notifications
notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

---

## Phase 1: Project Setup (15 min) ✅
- [x] Create Next.js project with TypeScript
- [x] Install dependencies (Supabase, ShadcnUI, etc.)
- [x] Set up Tailwind CSS
- [x] Initialize ShadcnUI components
- [x] Create environment variables structure
- [x] Set up Supabase client

## Phase 2: Database & Auth (20 min) ✅
- [x] Create SQL migration for tables
- [x] Set up Row Level Security (RLS) policies
- [x] Configure Supabase Auth trigger
- [x] Create auth middleware for route protection

## Phase 3: Core Layout & Navigation (15 min) ✅
- [x] Create app layout with sidebar
- [x] Build navigation component
- [x] Create auth layout (login/register)
- [x] Set up protected route wrappers

## Phase 4: Authentication Pages (20 min) ✅
- [x] Login page
- [x] Register page (clipper registration)
- [x] Pending approval page
- [x] Auth callback handler

## Phase 5: Admin Dashboard (40 min) ✅
- [x] Dashboard overview (stats cards)
- [x] Campaigns list page
- [x] Campaign create/edit form
- [x] Submissions management (approve/reject)
- [x] Clippers management (approve/reject access)
- [x] Payouts page with calculations
- [x] CSV export functionality
- [x] Notification bell component

## Phase 6: Clipper Portal (30 min) ✅
- [x] Clipper dashboard (their stats)
- [x] Active campaigns list
- [x] Submission form (with daily limit check)
- [x] Submissions history
- [x] Earnings overview

## Phase 7: Twitter API Integration (20 min) ✅
- [x] twitterapi.io client setup
- [x] Extract tweet ID from URL utility
- [x] Fetch tweet views function
- [x] API route for updating views (cron job ready)

## Phase 8: Payout Calculations (15 min) ✅
- [x] Calculate base payout ($4/1K views)
- [x] Apply multipliers (100K+ = 1.25x, 250K+ = 1.5x)
- [x] Generate payout summaries
- [x] CSV export for accounting

## Phase 9: Polish & Testing (15 min)
- [x] Build passes without errors
- [ ] Set up Supabase project (manual step)
- [ ] Test with real data
- [ ] Deploy to Vercel

---

## File Structure

```
newer/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx (landing/redirect)
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── callback/route.ts
│   │   └── pending/page.tsx
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   └── admin/
│   │       ├── page.tsx (dashboard)
│   │       ├── campaigns/
│   │       │   ├── page.tsx
│   │       │   ├── new/page.tsx
│   │       │   └── [id]/page.tsx
│   │       ├── submissions/page.tsx
│   │       ├── clippers/page.tsx
│   │       └── payouts/page.tsx
│   ├── (clipper)/
│   │   ├── layout.tsx
│   │   └── dashboard/
│   │       ├── page.tsx
│   │       ├── campaigns/page.tsx
│   │       ├── submit/[campaignId]/page.tsx
│   │       └── earnings/page.tsx
│   └── api/
│       ├── auth/callback/route.ts
│       ├── submissions/route.ts
│       ├── twitter/views/route.ts
│       └── cron/update-views/route.ts
├── components/
│   ├── ui/ (shadcn components)
│   ├── auth/
│   ├── admin/
│   ├── clipper/
│   └── shared/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── twitter.ts
│   ├── utils.ts
│   └── types.ts
├── middleware.ts
├── .env.local.example
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Twitter API (twitterapi.io)
TWITTER_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Key Implementation Notes

### Daily Submission Limit
- Check submissions table for clipper + campaign + current day
- Reject if already submitted today
- Use UTC dates for consistency

### View Count Updates
- Create API route `/api/cron/update-views`
- Can be called by Vercel cron or external scheduler
- Update all approved submissions from active campaigns
- Store `last_view_update` timestamp

### Payout Calculation Logic
```typescript
function calculatePayout(totalViews: number, ratePerK: number = 4): {
  baseAmount: number;
  multiplier: number;
  finalAmount: number;
} {
  const baseAmount = (totalViews / 1000) * ratePerK;
  let multiplier = 1.0;
  
  if (totalViews >= 250000) {
    multiplier = 1.5;
  } else if (totalViews >= 100000) {
    multiplier = 1.25;
  }
  
  return {
    baseAmount,
    multiplier,
    finalAmount: baseAmount * multiplier
  };
}
```

### Tweet ID Extraction
```typescript
function extractTweetId(url: string): string | null {
  // Handle x.com and twitter.com URLs
  const regex = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}
```

---

## Ready to Start!

Let's begin with Phase 1: Project Setup. Run these commands:

```bash
cd newer
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

Then we'll install dependencies and set up ShadcnUI.
