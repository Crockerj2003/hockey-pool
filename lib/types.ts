export interface Player {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Week {
  id: string;
  start_date: string;
  end_date: string;
  lock_time: string | null;
}

export type GameStatus = "scheduled" | "live" | "final";

export interface Game {
  id: string;
  nhl_game_id: number;
  week_id: string;
  home_team: string;
  away_team: string;
  home_team_logo: string;
  away_team_logo: string;
  game_date: string;
  game_time: string;
  status: GameStatus;
  winner: string | null;
}

export interface Pick {
  id: string;
  player_id: string;
  game_id: string;
  picked_team: string;
  is_correct: boolean | null;
  created_at: string;
}

export interface PickWithGame extends Pick {
  game: Game;
}

export interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  correct: number;
  total: number;
}

export interface NHLGame {
  id: number;
  startTimeUTC: string;
  gameState: string;
  homeTeam: {
    abbrev: string;
    logo: string;
    score?: number;
  };
  awayTeam: {
    abbrev: string;
    logo: string;
    score?: number;
  };
  gameDate?: string;
}

export interface NHLScheduleResponse {
  gameWeek: {
    date: string;
    dayAbbrev: string;
    numberOfGames: number;
    games: NHLGame[];
  }[];
}

export interface NHLScoreResponse {
  games: NHLGame[];
}
