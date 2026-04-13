import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { PlayoffLeaderboardEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function jsonNoStore(payload: unknown) {
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET() {
  const { data: players } = await supabase
    .from("players")
    .select("id,name");

  if (!players?.length) {
    return jsonNoStore({ leaderboard: [] });
  }

  const { data: allPicks } = await supabase
    .from("playoff_picks")
    .select("player_id, stat_value, is_goalie");

  const byParticipant = new Map<
    string,
    { total: number; skaters: number; goalies: number }
  >();

  for (const row of allPicks || []) {
    const cur = byParticipant.get(row.player_id) || {
      total: 0,
      skaters: 0,
      goalies: 0,
    };
    cur.total += row.stat_value ?? 0;
    if (row.is_goalie) cur.goalies += 1;
    else cur.skaters += 1;
    byParticipant.set(row.player_id, cur);
  }

  const leaderboard: PlayoffLeaderboardEntry[] = [];

  for (const p of players) {
    const agg = byParticipant.get(p.id);
    if (agg && agg.skaters + agg.goalies > 0) {
      leaderboard.push({
        player_id: p.id,
        player_name: p.name,
        total_points: agg.total,
        skater_slots: agg.skaters,
        goalie_slots: agg.goalies,
      });
    }
  }

  leaderboard.sort((a, b) => b.total_points - a.total_points);

  return jsonNoStore({ leaderboard });
}
