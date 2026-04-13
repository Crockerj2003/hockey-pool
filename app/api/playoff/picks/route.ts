import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase";
import {
  fetchPlayoffBracketTeams,
  fetchTeamRoster,
} from "@/lib/nhl-playoff";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("player_id");

  const { data: settings } = await supabase
    .from("playoff_settings")
    .select("picks_lock_at")
    .limit(1)
    .maybeSingle();

  const picks_locked =
    !!settings?.picks_lock_at &&
    new Date() >= new Date(settings.picks_lock_at);

  if (playerId) {
    const { data: picks } = await supabase
      .from("playoff_picks")
      .select("*")
      .eq("player_id", playerId)
      .order("is_goalie", { ascending: true })
      .order("player_name", { ascending: true });

    return NextResponse.json({
      picks: picks || [],
      picks_locked,
    });
  }

  const { data: picks } = await supabase
    .from("playoff_picks")
    .select("*")
    .order("player_name", { ascending: true });

  const { data: playerRows } = await supabase.from("players").select("id,name");
  const nameById = new Map((playerRows || []).map((p) => [p.id, p.name]));

  const picksWithNames = (picks || []).map((row) => ({
    ...row,
    player_name_display: nameById.get(row.player_id) ?? "Unknown",
  }));

  return NextResponse.json({
    picks: picksWithNames,
    picks_locked,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_id, roster } = body as {
      player_id?: string;
      roster?: Array<{
        nhl_player_id: number;
        team_abbrev: string;
        is_goalie: boolean;
      }>;
    };

    if (!player_id || !Array.isArray(roster)) {
      return NextResponse.json(
        { error: "player_id and roster are required" },
        { status: 400 }
      );
    }

    const { data: settings } = await supabase
      .from("playoff_settings")
      .select("picks_lock_at, bracket_calendar_year")
      .limit(1)
      .maybeSingle();

    if (
      settings?.picks_lock_at &&
      new Date() >= new Date(settings.picks_lock_at)
    ) {
      return NextResponse.json(
        { error: "Playoff picks are locked." },
        { status: 403 }
      );
    }

    const { count: existing } = await supabase
      .from("playoff_picks")
      .select("*", { count: "exact", head: true })
      .eq("player_id", player_id);

    if ((existing || 0) > 0) {
      return NextResponse.json(
        { error: "Playoff roster already submitted. Updates are not allowed." },
        { status: 409 }
      );
    }

    const skaters = roster.filter((r) => !r.is_goalie);
    const goalies = roster.filter((r) => r.is_goalie);
    if (skaters.length !== 15 || goalies.length !== 1) {
      return NextResponse.json(
        { error: "Select exactly 15 skaters and 1 goalie." },
        { status: 400 }
      );
    }

    const calendarYear = settings?.bracket_calendar_year ?? 2026;
    let bracketTeams: Awaited<ReturnType<typeof fetchPlayoffBracketTeams>>;
    try {
      bracketTeams = await fetchPlayoffBracketTeams(calendarYear);
    } catch {
      return NextResponse.json(
        { error: "Could not load playoff bracket." },
        { status: 400 }
      );
    }

    const bracketAbbrevs = new Set(bracketTeams.map((t) => t.abbrev));

    const teamsNeeded = new Set<string>();
    for (const row of roster) {
      const abbr = (row.team_abbrev || "").trim().toUpperCase();
      if (!abbr || !bracketAbbrevs.has(abbr)) {
        return NextResponse.json(
          { error: `Invalid or non-playoff team: ${row.team_abbrev}` },
          { status: 400 }
        );
      }
      teamsNeeded.add(abbr);
    }

    const rosterByTeam = new Map<
      string,
      Map<number, { is_goalie: boolean; name: string }>
    >();

    for (const abbr of Array.from(teamsNeeded)) {
      let validRoster: Awaited<ReturnType<typeof fetchTeamRoster>>;
      try {
        validRoster = await fetchTeamRoster(abbr);
      } catch {
        return NextResponse.json(
          { error: `Could not validate roster for ${abbr}.` },
          { status: 400 }
        );
      }
      rosterByTeam.set(
        abbr,
        new Map(
          validRoster.map((p) => [
            p.nhl_player_id,
            { is_goalie: p.is_goalie, name: p.name },
          ])
        )
      );
    }

    const seen = new Set<number>();
    for (const row of roster) {
      if (seen.has(row.nhl_player_id)) {
        return NextResponse.json(
          { error: "Duplicate player selected." },
          { status: 400 }
        );
      }
      seen.add(row.nhl_player_id);

      const abbr = row.team_abbrev.trim().toUpperCase();
      const byId = rosterByTeam.get(abbr);
      const meta = byId?.get(row.nhl_player_id);
      if (!meta) {
        return NextResponse.json(
          {
            error: `Player ${row.nhl_player_id} is not on ${abbr}'s roster.`,
          },
          { status: 400 }
        );
      }
      if (meta.is_goalie !== row.is_goalie) {
        return NextResponse.json(
          { error: "Skater/goalie role does not match roster." },
          { status: 400 }
        );
      }
    }

    const service = getServiceSupabase();
    const insertData = roster.map((r) => {
      const abbr = r.team_abbrev.trim().toUpperCase();
      const meta = rosterByTeam.get(abbr)!.get(r.nhl_player_id)!;
      return {
        player_id,
        team_abbrev: abbr,
        nhl_player_id: r.nhl_player_id,
        player_name: meta.name,
        is_goalie: r.is_goalie,
        stat_value: 0,
      };
    });

    const { error } = await service.from("playoff_picks").insert(insertData);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Playoff roster already submitted." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: `Failed to save: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, saved: insertData.length });
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid request", details: String(e) },
      { status: 400 }
    );
  }
}
