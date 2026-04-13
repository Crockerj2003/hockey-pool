import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import {
  extractPlayoffFantasyValue,
  fetchPlayerLanding,
} from "@/lib/nhl-playoff";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const token = authHeader?.replace("Bearer ", "");
  return token === cronSecret || token === adminPassword;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceSupabase();

  const { data: rows } = await supabase
    .from("playoff_picks")
    .select("nhl_player_id, is_goalie");

  const uniq = new Map<number, boolean>();
  for (const r of rows || []) {
    uniq.set(r.nhl_player_id, r.is_goalie);
  }

  const stats = new Map<number, number>();
  for (const [nhlId, isGoalie] of Array.from(uniq.entries())) {
    try {
      const landing = await fetchPlayerLanding(nhlId);
      stats.set(nhlId, extractPlayoffFantasyValue(landing, isGoalie));
    } catch {
      stats.set(nhlId, 0);
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  let updated = 0;
  for (const [nhlId, value] of Array.from(stats.entries())) {
    const { error } = await supabase
      .from("playoff_picks")
      .update({ stat_value: value })
      .eq("nhl_player_id", nhlId);
    if (!error) updated++;
  }

  return NextResponse.json({ success: true, players_updated: stats.size, rows_touched: updated });
}
