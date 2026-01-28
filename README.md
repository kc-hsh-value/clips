# Clipper Campaign Management Dashboard

A web-based dashboard to manage weekly clipper marketing campaigns. Clippers create short clips from long-form content and post them on X (Twitter). Payment is based on views generated ($4/1K views with multipliers).

## Features

### Admin Dashboard
- 📊 Dashboard with campaign statistics
- 🎬 Campaign management (create, edit, manage clippers)
- 👥 Clipper approval workflow
- ✅ Submission review and approval
- 💰 Payout calculations with multipliers
- 📥 CSV export for accounting
- 🔔 Real-time notifications

### Clipper Portal
- 📋 View assigned campaigns
- 📤 Submit X (Twitter) clip URLs
- ⏰ 1 submission per campaign per day limit
- 📈 Track views and earnings
- 💵 View payout history

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **API**: twitterapi.io (for fetching tweet view counts)
- **UI**: ShadcnUI + Tailwind CSS

## Getting Started

### 1. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration script from `supabase/schema.sql`
3. Enable Email Auth in Authentication settings

### 2. Configure Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `TWITTER_API_KEY` - Your twitterapi.io API key
- `CRON_SECRET` (optional) - Secret for securing cron endpoints

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Create Admin User

1. Register a new account
2. In Supabase SQL Editor, update the user's role:

```sql
UPDATE profiles 
SET role = 'admin', status = 'approved' 
WHERE email = 'your-email@example.com';
```

## Payment Structure

- **Base rate**: $4 per 1,000 views
- **100K+ views**: 1.25x multiplier
- **250K+ views**: 1.5x multiplier

## Cron Jobs

The app includes two cron endpoints for automated tasks:

- `/api/cron/update-views` - Updates view counts daily
- `/api/cron/process-payouts` - Generates payouts for completed campaigns

Configure in Vercel or use an external scheduler.

## Project Structure

```
app/
├── (auth)/           # Authentication pages
├── (admin)/          # Admin dashboard
├── (clipper)/        # Clipper portal
├── api/              # API routes
└── auth/             # Auth callbacks

components/
├── admin/            # Admin components
├── clipper/          # Clipper components
└── ui/               # ShadcnUI components

lib/
├── supabase/         # Supabase client setup
├── twitter.ts        # Twitter API integration
├── payout.ts         # Payout calculations
└── types.ts          # TypeScript types
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

Don't forget to:
1. Add environment variables in Vercel dashboard
2. Enable cron jobs in vercel.json

## License

MIT
