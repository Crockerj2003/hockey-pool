import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { fetchAllPlayoffTeamRosters } from "@/lib/nhl-playoff";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: settings } = await supabase
    .from("playoff_settings")
    .select("bracket_calendar_year")
    .limit(1)
    .maybeSingle();

  const year = settings?.bracket_calendar_year ?? 2026;

  try {
    const { skaters, goalies } = await fetchAllPlayoffTeamRosters(year);
    return NextResponse.json({ skaters, goalies });
  } catch (e) {
    return NextResponse.json(
      {
        skaters: [],
        goalies: [],
        error: e instanceof Error ? e.message : "Failed to load rosters",
      },
      { status: 502 }
    );
  }
}
