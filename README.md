# Hockey Pool

A mobile-first web app for picking NHL game winners with your friends. Pick every Friday, Saturday, and Sunday game, track standings, and see how everyone's doing.

## Features

- **Pick Games**: Select the winner of every NHL game on the weekend (Fri/Sat/Sun)
- **Leaderboard**: Track standings for the current weekend and all-time
- **View All Picks**: Collapsible view showing each player's picks and results
- **Auto-Sync**: NHL API integration automatically loads games and updates scores
- **Admin Panel**: Add/remove players, manually sync games, override results
- **Mobile-First**: Designed primarily for phones with a bottom navigation bar

## Tech Stack

- **Next.js 14** (App Router) - React framework
- **Tailwind CSS** - Styling
- **Supabase** - PostgreSQL database
- **NHL API** - Game schedules and scores (free, no key needed)
- **Vercel** - Hosting with cron jobs

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to the **SQL Editor** in your Supabase dashboard
3. Copy and paste the contents of `supabase/migration.sql` and run it
4. Go to **Settings > API** and copy your project URL and keys

### 2. Install Dependencies

```bash
cd hockey-pool
npm install
```

### 3. Configure Environment Variables

Edit `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_PASSWORD=pick-a-strong-password
CRON_SECRET=pick-a-random-secret
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Initial Setup

1. Go to `/admin` and log in with your `ADMIN_PASSWORD`
2. Add your friends' names in the **Players** tab
3. Click **Sync Games & Scores** in the **Sync** tab to pull this weekend's games

### 6. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com), import the repo
3. Add environment variables in the Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD`
   - `CRON_SECRET`
4. Deploy! The cron job in `vercel.json` will auto-sync scores every 15 minutes on game days

### Cron Job

The cron schedule in `vercel.json` runs every 15 minutes on Fri/Sat/Sun from 5PM-11PM UTC:

```
*/15 17-23 * * 5,6,0
```

For the Vercel cron to authenticate, it sends the `CRON_SECRET` as a bearer token. Make sure this env var is set.

## How It Works

1. **Admin** adds player names via the admin panel
2. **Games sync** automatically from the NHL API (or manually via admin)
3. **Players** visit the site, select their name, and pick winners for each game
4. **Picks lock** when the first game of the weekend starts
5. **Scores update** automatically via the cron job
6. **Leaderboard** shows who's winning this weekend and all-time
