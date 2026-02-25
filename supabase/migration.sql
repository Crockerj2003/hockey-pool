-- Hockey Pool Database Schema
-- Run this SQL in your Supabase SQL Editor to create all tables

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Players table
create table if not exists players (
  id uuid primary key default uuid_generate_v4(),
  name text unique not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Weeks table
create table if not exists weeks (
  id uuid primary key default uuid_generate_v4(),
  start_date date not null,
  end_date date not null,
  lock_time timestamptz,
  unique(start_date, end_date)
);

-- Games table
create table if not exists games (
  id uuid primary key default uuid_generate_v4(),
  nhl_game_id integer unique not null,
  week_id uuid references weeks(id) on delete cascade,
  home_team text not null,
  away_team text not null,
  home_team_logo text not null default '',
  away_team_logo text not null default '',
  game_date date not null,
  game_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'final')),
  winner text
);

-- Picks table
create table if not exists picks (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references players(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  picked_team text not null,
  is_correct boolean,
  created_at timestamptz default now(),
  unique(player_id, game_id)
);

-- Indexes for faster queries
create index if not exists idx_games_week_id on games(week_id);
create index if not exists idx_games_game_date on games(game_date);
create index if not exists idx_picks_player_id on picks(player_id);
create index if not exists idx_picks_game_id on picks(game_id);
create index if not exists idx_weeks_start_date on weeks(start_date);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
alter table players enable row level security;
alter table weeks enable row level security;
alter table games enable row level security;
alter table picks enable row level security;

-- Allow public read access to all tables
create policy "Public read access" on players for select using (true);
create policy "Public read access" on weeks for select using (true);
create policy "Public read access" on games for select using (true);
create policy "Public read access" on picks for select using (true);

-- Allow public insert/update on picks (players submit their own picks)
create policy "Public insert picks" on picks for insert with check (true);
create policy "Public update picks" on picks for update using (true);

-- Service role has full access (for admin operations and sync)
-- This is handled automatically by Supabase service role key
