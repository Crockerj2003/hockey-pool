import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentWeekendDates } from "@/lib/dates";
import { LeaderboardEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(payload: unknown) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") || "weekend";

  const { data: players } = await supabase
    .from("players")
    .select("*");

  if (!players) {
    return jsonNoStore({ leaderboard: [] });
  }

  if (mode === "alltime") {
    // All-time leaderboard: count all correct picks for each player
    const leaderboard: LeaderboardEntry[] = [];

    for (const player of players) {
      const { count: correct } = await supabase
        .from("picks")
        .select("*", { count: "exact", head: true })
        .eq("player_id", player.id)
        .eq("is_correct", true);

      const { count: total } = await supabase
        .from("picks")
        .select("*", { count: "exact", head: true })
        .eq("player_id", player.id);

      const totalPicks = total || 0;
      if (totalPicks > 0) {
        leaderboard.push({
          player_id: player.id,
          player_name: player.name,
          correct: correct || 0,
          total: totalPicks,
        });
      }
    }

    leaderboard.sort((a, b) => b.correct - a.correct);
    return jsonNoStore({ leaderboard });
  }

  // Weekend leaderboard
  const { friday, sunday } = getCurrentWeekendDates();

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("start_date", friday)
    .eq("end_date", sunday)
    .single();

  let targetWeekId = week?.id;
  if (!targetWeekId) {
    // Fallback: if current weekend row is missing, use the latest week
    // so standings still render for recently synced games.
    const { data: latestWeek } = await supabase
      .from("weeks")
      .select("id")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    targetWeekId = latestWeek?.id;
  }

  if (!targetWeekId) {
    return jsonNoStore({ leaderboard: [] });
  }

  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("week_id", targetWeekId);

  const gameIds = (games || []).map((g) => g.id);

  if (gameIds.length === 0) {
    return jsonNoStore({ leaderboard: [] });
  }

  const leaderboard: LeaderboardEntry[] = [];

  for (const player of players) {
    const { data: playerPicks } = await supabase
      .from("picks")
      .select("*")
      .eq("player_id", player.id)
      .in("game_id", gameIds);

    const correct = (playerPicks || []).filter(
      (p) => p.is_correct === true
    ).length;
    const total = (playerPicks || []).length;

    if (total > 0) {
      leaderboard.push({
        player_id: player.id,
        player_name: player.name,
        correct,
        total,
      });
    }
  }

  leaderboard.sort((a, b) => b.correct - a.correct);
  return jsonNoStore({ leaderboard, total_games: gameIds.length });
}
