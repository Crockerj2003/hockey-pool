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

-- ---------------------------------------------------------------------------
-- Playoff pool (single entry per pool participant for the whole postseason)
-- ---------------------------------------------------------------------------

create table if not exists playoff_settings (
  id uuid primary key default uuid_generate_v4(),
  bracket_calendar_year int not null default 2026,
  season_id text not null default '20252026',
  picks_lock_at timestamptz
);

-- Exactly one settings row (insert manually in Supabase if empty)
insert into playoff_settings (bracket_calendar_year, season_id)
select 2026, '20252026'
where not exists (select 1 from playoff_settings limit 1);

create table if not exists playoff_picks (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid not null references players(id) on delete cascade,
  nhl_player_id bigint not null,
  team_abbrev text not null,
  player_name text not null,
  is_goalie boolean not null default false,
  stat_value int not null default 0,
  created_at timestamptz default now(),
  unique(player_id, nhl_player_id)
);

create index if not exists idx_playoff_picks_player_id on playoff_picks(player_id);
create index if not exists idx_playoff_picks_nhl_player_id on playoff_picks(nhl_player_id);

alter table playoff_settings enable row level security;
alter table playoff_picks enable row level security;

create policy "Public read playoff_settings" on playoff_settings for select using (true);
create policy "Public read playoff_picks" on playoff_picks for select using (true);
create policy "Public insert playoff_picks" on playoff_picks for insert with check (true);
