import { NHLGame, NHLScheduleResponse, NHLScoreResponse } from "./types";

const NHL_API_BASE = "https://api-web.nhle.com/v1";

/**
 * Fetch the weekly schedule from the NHL API for a given date.
 * The API returns a full week of games grouped by date.
 */
export async function fetchNHLSchedule(
  date: string
): Promise<NHLScheduleResponse> {
  const res = await fetch(`${NHL_API_BASE}/schedule/${date}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`NHL API schedule error: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch scores for a specific date from the NHL API.
 */
export async function fetchNHLScores(
  date: string
): Promise<NHLScoreResponse> {
  const res = await fetch(`${NHL_API_BASE}/score/${date}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`NHL API score error: ${res.status}`);
  }
  return res.json();
}

/**
 * Extract games for specific dates from the schedule response.
 */
export function extractGamesForDates(
  schedule: NHLScheduleResponse,
  dates: string[]
): NHLGame[] {
  const games: NHLGame[] = [];
  for (const day of schedule.gameWeek) {
    if (dates.includes(day.date)) {
      games.push(...day.games);
    }
  }
  return games;
}

/**
 * Determine the winner of a finished game.
 * Returns the abbreviation of the winning team, or null if the game isn't final.
 */
export function getGameWinner(game: NHLGame): string | null {
  const finalStates = ["OFF", "FINAL", "OVER"];
  if (!finalStates.includes(game.gameState)) return null;

  const homeScore = game.homeTeam.score ?? 0;
  const awayScore = game.awayTeam.score ?? 0;

  if (homeScore > awayScore) return game.homeTeam.abbrev;
  if (awayScore > homeScore) return game.awayTeam.abbrev;
  return null;
}

/**
 * Map NHL game state to our internal status.
 */
export function mapGameStatus(
  gameState: string
): "scheduled" | "live" | "final" {
  const finalStates = ["OFF", "FINAL", "OVER"];
  const liveStates = ["LIVE", "CRIT"];

  if (finalStates.includes(gameState)) return "final";
  if (liveStates.includes(gameState)) return "live";
  return "scheduled";
}
