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
  const requestedWeekId = searchParams.get("week_id");

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
    return jsonNoStore({ leaderboard, weeks: [] });
  }

  // Weekend leaderboard
  const { friday, sunday } = getCurrentWeekendDates();
  const { data: weeks } = await supabase
    .from("weeks")
    .select("id,start_date,end_date")
    .order("start_date", { ascending: false });

  const availableWeeks = weeks || [];

  if (availableWeeks.length === 0) {
    return jsonNoStore({ leaderboard: [], weeks: [], total_games: 0 });
  }

  let targetWeekId = requestedWeekId || null;

  // If a week was explicitly chosen, honor it when valid.
  if (targetWeekId) {
    const exists = availableWeeks.some((w) => w.id === targetWeekId);
    if (!exists) {
      targetWeekId = null;
    }
  }

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .eq("start_date", friday)
    .eq("end_date", sunday)
    .single();

  if (!targetWeekId) {
    targetWeekId = week?.id || null;
  }

  if (!targetWeekId) {
    // Fallback: if current weekend row is missing, use the latest week
    // so standings still render for recently synced games.
    targetWeekId = availableWeeks[0].id;
  }

  if (!targetWeekId) {
    return jsonNoStore({ leaderboard: [], weeks: availableWeeks, total_games: 0 });
  }

  const { data: games } = await supabase
    .from("games")
    .select("id")
    .eq("week_id", targetWeekId);

  const gameIds = (games || []).map((g) => g.id);

  if (gameIds.length === 0) {
    return jsonNoStore({
      leaderboard: [],
      weeks: availableWeeks,
      selected_week_id: targetWeekId,
      total_games: 0,
    });
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
  return jsonNoStore({
    leaderboard,
    weeks: availableWeeks,
    selected_week_id: targetWeekId,
    total_games: gameIds.length,
  });
}
