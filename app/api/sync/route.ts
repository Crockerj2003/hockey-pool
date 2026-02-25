import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import {
  fetchNHLSchedule,
  fetchNHLScores,
  extractGamesForDates,
  getGameWinner,
  mapGameStatus,
} from "@/lib/nhl";
import { getCurrentWeekendDates } from "@/lib/dates";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const token = authHeader?.replace("Bearer ", "");
  return token === cronSecret || token === adminPassword;
}

// GET is used by Vercel Cron
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncGames();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

// POST is used by admin manual sync
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncGames();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function syncGames() {
  const supabase = getServiceSupabase();
  const { friday, saturday, sunday } = getCurrentWeekendDates();
  const weekendDates = [friday, saturday, sunday];

  // Upsert the week record
  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .upsert(
      { start_date: friday, end_date: sunday },
      { onConflict: "start_date,end_date" }
    )
    .select()
    .single();

  if (weekError) throw new Error(`Week upsert failed: ${weekError.message}`);

  // Fetch schedule from NHL API (fetching from Friday gives us the whole week)
  const schedule = await fetchNHLSchedule(friday);
  const nhlGames = extractGamesForDates(schedule, weekendDates);

  let gamesUpserted = 0;
  let earliestGameTime: string | null = null;

  // Upsert each game
  for (const nhlGame of nhlGames) {
    const gameTime = nhlGame.startTimeUTC;

    if (!earliestGameTime || gameTime < earliestGameTime) {
      earliestGameTime = gameTime;
    }

    const gameDate =
      nhlGame.gameDate || nhlGame.startTimeUTC.substring(0, 10);

    const { error } = await supabase.from("games").upsert(
      {
        nhl_game_id: nhlGame.id,
        week_id: week.id,
        home_team: nhlGame.homeTeam.abbrev,
        away_team: nhlGame.awayTeam.abbrev,
        home_team_logo:
          nhlGame.homeTeam.logo ||
          `https://assets.nhle.com/logos/nhl/svg/${nhlGame.homeTeam.abbrev}_dark.svg`,
        away_team_logo:
          nhlGame.awayTeam.logo ||
          `https://assets.nhle.com/logos/nhl/svg/${nhlGame.awayTeam.abbrev}_dark.svg`,
        game_date: gameDate,
        game_time: gameTime,
        status: mapGameStatus(nhlGame.gameState),
        winner: getGameWinner(nhlGame),
      },
      { onConflict: "nhl_game_id" }
    );

    if (!error) gamesUpserted++;
  }

  // Update lock_time on the week
  if (earliestGameTime) {
    await supabase
      .from("weeks")
      .update({ lock_time: earliestGameTime })
      .eq("id", week.id);
  }

  // Now fetch scores for each date to update results
  let scoresUpdated = 0;
  for (const date of weekendDates) {
    try {
      const scores = await fetchNHLScores(date);
      for (const game of scores.games) {
        const winner = getGameWinner(game);
        const status = mapGameStatus(game.gameState);

        if (status === "live" || status === "final") {
          const { error } = await supabase
            .from("games")
            .update({ status, winner })
            .eq("nhl_game_id", game.id);

          if (!error && winner) {
            // Update picks correctness for this game
            const { data: gameRow } = await supabase
              .from("games")
              .select("id")
              .eq("nhl_game_id", game.id)
              .single();

            if (gameRow) {
              // Mark correct picks
              await supabase
                .from("picks")
                .update({ is_correct: true })
                .eq("game_id", gameRow.id)
                .eq("picked_team", winner);

              // Mark incorrect picks
              await supabase
                .from("picks")
                .update({ is_correct: false })
                .eq("game_id", gameRow.id)
                .neq("picked_team", winner);

              scoresUpdated++;
            }
          }
        }
      }
    } catch {
      // Score endpoint might 404 for future dates
    }
  }

  return {
    success: true,
    week_id: week.id,
    games_upserted: gamesUpserted,
    scores_updated: scoresUpdated,
    weekend: { friday, saturday, sunday },
  };
}
