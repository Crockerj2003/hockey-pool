const NHL_API_BASE = "https://api-web.nhle.com/v1";

export interface NhlRosterPlayer {
  id: number;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
  sweaterNumber?: number;
}

export interface ParsedRosterPlayer {
  nhl_player_id: number;
  name: string;
  positionCode: string;
  is_goalie: boolean;
}

export interface PlayoffBracketTeam {
  abbrev: string;
  name: string;
  logo: string;
}

interface PlayoffBracketResponse {
  series?: Array<{
    topSeedTeam?: { abbrev: string; name?: { default: string }; logo?: string };
    bottomSeedTeam?: { abbrev: string; name?: { default: string }; logo?: string };
  }>;
}

interface RosterResponse {
  forwards?: NhlRosterPlayer[];
  defensemen?: NhlRosterPlayer[];
  goalies?: NhlRosterPlayer[];
}

interface ScheduleDay {
  date: string;
  games?: Array<{ gameType: number; startTimeUTC: string }>;
}

interface ScheduleResponse {
  gameWeek?: ScheduleDay[];
}

interface PlayerLandingResponse {
  featuredStats?: {
    playoffs?: {
      subSeason?: {
        points?: number;
        goals?: number;
        assists?: number;
        wins?: number;
      };
    };
  };
}

function teamFromSeed(seed: {
  abbrev: string;
  name?: { default: string };
  logo?: string;
}): PlayoffBracketTeam {
  return {
    abbrev: seed.abbrev,
    name: seed.name?.default ?? seed.abbrev,
    logo:
      seed.logo ||
      `https://assets.nhle.com/logos/nhl/svg/${seed.abbrev}_dark.svg`,
  };
}

export async function fetchPlayoffBracketTeams(
  calendarYear: number
): Promise<PlayoffBracketTeam[]> {
  const res = await fetch(`${NHL_API_BASE}/playoff-bracket/${calendarYear}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Playoff bracket error: ${res.status}`);
  }
  const data = (await res.json()) as PlayoffBracketResponse;
  const map = new Map<string, PlayoffBracketTeam>();
  for (const s of data.series || []) {
    if (s.topSeedTeam) {
      const t = teamFromSeed(s.topSeedTeam);
      map.set(t.abbrev, t);
    }
    if (s.bottomSeedTeam) {
      const t = teamFromSeed(s.bottomSeedTeam);
      map.set(t.abbrev, t);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.abbrev.localeCompare(b.abbrev));
}

export async function fetchTeamRoster(teamAbbrev: string): Promise<ParsedRosterPlayer[]> {
  const res = await fetch(`${NHL_API_BASE}/roster/${teamAbbrev}/current`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`Roster error: ${res.status}`);
  }
  const data = (await res.json()) as RosterResponse;
  const out: ParsedRosterPlayer[] = [];

  const pushList = (list: NhlRosterPlayer[] | undefined, isGoalie: boolean) => {
    for (const p of list || []) {
      const first = p.firstName?.default ?? "";
      const last = p.lastName?.default ?? "";
      const name = `${first} ${last}`.trim();
      out.push({
        nhl_player_id: p.id,
        name,
        positionCode: p.positionCode,
        is_goalie: isGoalie,
      });
    }
  };

  pushList(data.forwards, false);
  pushList(data.defensemen, false);
  pushList(data.goalies, true);

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export interface ParsedRosterPlayerWithTeam extends ParsedRosterPlayer {
  team_abbrev: string;
  /** Regular-season points from club stats (skaters). */
  season_points?: number;
  /** Regular-season wins from club stats (goalies). */
  season_wins?: number;
}

interface ClubStatsNowResponse {
  skaters?: Array<{ playerId: number; points?: number }>;
  goalies?: Array<{ playerId: number; wins?: number }>;
}

/**
 * Team season totals (regular season) for sorting and display.
 */
export async function fetchClubStatsNow(teamAbbrev: string): Promise<{
  pointsByPlayer: Map<number, number>;
  winsByPlayer: Map<number, number>;
}> {
  const res = await fetch(
    `${NHL_API_BASE}/club-stats/${encodeURIComponent(teamAbbrev)}/now`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) {
    return { pointsByPlayer: new Map(), winsByPlayer: new Map() };
  }
  const data = (await res.json()) as ClubStatsNowResponse;
  const pointsByPlayer = new Map<number, number>();
  for (const s of data.skaters || []) {
    pointsByPlayer.set(s.playerId, s.points ?? 0);
  }
  const winsByPlayer = new Map<number, number>();
  for (const g of data.goalies || []) {
    winsByPlayer.set(g.playerId, g.wins ?? 0);
  }
  return { pointsByPlayer, winsByPlayer };
}

async function attachSeasonStatsToRoster(
  players: ParsedRosterPlayerWithTeam[]
): Promise<void> {
  const teamAbbrevs = Array.from(new Set(players.map((p) => p.team_abbrev)));
  const statsList = await Promise.all(
    teamAbbrevs.map((abbr) => fetchClubStatsNow(abbr))
  );
  const byTeam = new Map(
    teamAbbrevs.map((abbr, i) => [abbr, statsList[i]])
  );
  for (const p of players) {
    const stat = byTeam.get(p.team_abbrev);
    if (!stat) continue;
    if (p.is_goalie) {
      p.season_wins = stat.winsByPlayer.get(p.nhl_player_id) ?? 0;
    } else {
      p.season_points = stat.pointsByPlayer.get(p.nhl_player_id) ?? 0;
    }
  }
}

/**
 * All skaters and goalies from every team in the current playoff bracket.
 * NHL player IDs are de-duplicated (one row per player).
 * Season points / wins are filled from `/club-stats/{team}/now` for sorting.
 */
export async function fetchAllPlayoffTeamRosters(calendarYear: number): Promise<{
  skaters: ParsedRosterPlayerWithTeam[];
  goalies: ParsedRosterPlayerWithTeam[];
}> {
  const teams = await fetchPlayoffBracketTeams(calendarYear);
  const chunks = await Promise.all(
    teams.map(async (t) => {
      try {
        const r = await fetchTeamRoster(t.abbrev);
        return r.map(
          (p): ParsedRosterPlayerWithTeam => ({
            ...p,
            team_abbrev: t.abbrev,
          })
        );
      } catch {
        return [];
      }
    })
  );
  const flat = chunks.flat();
  const seen = new Set<number>();
  const deduped: ParsedRosterPlayerWithTeam[] = [];
  for (const p of flat) {
    if (seen.has(p.nhl_player_id)) continue;
    seen.add(p.nhl_player_id);
    deduped.push(p);
  }
  await attachSeasonStatsToRoster(deduped);
  return {
    skaters: deduped.filter((p) => !p.is_goalie),
    goalies: deduped.filter((p) => p.is_goalie),
  };
}

export async function fetchPlayerLanding(
  nhlPlayerId: number
): Promise<PlayerLandingResponse> {
  const res = await fetch(`${NHL_API_BASE}/player/${nhlPlayerId}/landing`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`Player landing error: ${res.status}`);
  }
  return res.json() as Promise<PlayerLandingResponse>;
}

/**
 * Skaters: playoff points. Goalies: playoff wins.
 */
export function extractPlayoffFantasyValue(
  landing: PlayerLandingResponse,
  isGoalie: boolean
): number {
  const sub = landing.featuredStats?.playoffs?.subSeason;
  if (!sub) return 0;
  if (isGoalie) {
    return typeof sub.wins === "number" ? sub.wins : 0;
  }
  if (typeof sub.points === "number") return sub.points;
  const g = sub.goals ?? 0;
  const a = sub.assists ?? 0;
  return g + a;
}

/**
 * Scan schedule days for the first postseason game (gameType 3).
 */
export async function findFirstPlayoffPuckDropUtc(
  fromDate: string,
  toDate: string
): Promise<string | null> {
  const start = new Date(fromDate + "T12:00:00Z");
  const end = new Date(toDate + "T12:00:00Z");
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;
    const res = await fetch(`${NHL_API_BASE}/schedule/${dateStr}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as ScheduleResponse;
    for (const week of data.gameWeek || []) {
      for (const g of week.games || []) {
        if (g.gameType === 3 && g.startTimeUTC) {
          return g.startTimeUTC;
        }
      }
    }
  }
  return null;
}
