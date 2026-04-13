import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchPlayoffBracketTeams } from "@/lib/nhl-playoff";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: settings } = await supabase
    .from("playoff_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const { data: submittedRows } = await supabase
    .from("playoff_picks")
    .select("player_id");

  const submitted_player_ids = Array.from(
    new Set((submittedRows || []).map((r) => r.player_id))
  );

  if (!settings) {
    return NextResponse.json({
      settings: null,
      teams: [],
      picks_locked: false,
      submitted_player_ids,
    });
  }

  let teams: Awaited<ReturnType<typeof fetchPlayoffBracketTeams>> = [];
  try {
    teams = await fetchPlayoffBracketTeams(settings.bracket_calendar_year);
  } catch {
    teams = [];
  }

  const picks_locked =
    !!settings.picks_lock_at &&
    new Date() >= new Date(settings.picks_lock_at);

  return NextResponse.json({
    settings,
    teams,
    picks_locked,
    submitted_player_ids,
  });
}
