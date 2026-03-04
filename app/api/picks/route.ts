import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase";
import { getCurrentWeekendDates } from "@/lib/dates";

export const dynamic = "force-dynamic";

// GET /api/picks?player_id=xxx or GET /api/picks (all picks for current weekend)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get("player_id");
  const weekId = searchParams.get("week_id");

  let week: { id: string; lock_time: string | null } | null = null;

  if (weekId) {
    const { data } = await supabase
      .from("weeks")
      .select("*")
      .eq("id", weekId)
      .maybeSingle();
    week = data;
  } else {
    const { friday, sunday } = getCurrentWeekendDates();

    // Get the current week
    const { data } = await supabase
      .from("weeks")
      .select("*")
      .eq("start_date", friday)
      .eq("end_date", sunday)
      .single();
    week = data;
  }

  if (!week) {
    return NextResponse.json({ picks: [], games: [] });
  }

  // Get games for this week
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("week_id", week.id)
    .order("game_date", { ascending: true })
    .order("game_time", { ascending: true });

  // Get picks
  let picksQuery = supabase
    .from("picks")
    .select("*, game:games(*)")
    .in(
      "game_id",
      (games || []).map((g) => g.id)
    );

  if (playerId) {
    picksQuery = picksQuery.eq("player_id", playerId);
  }

  const { data: picks } = await picksQuery;

  return NextResponse.json({
    picks: picks || [],
    games: games || [],
    week,
  });
}

// POST /api/picks - Submit picks for a player
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_id, picks } = body as {
      player_id: string;
      picks: { game_id: string; picked_team: string }[];
    };

    if (!player_id || !picks || !Array.isArray(picks)) {
      return NextResponse.json(
        { error: "player_id and picks array are required" },
        { status: 400 }
      );
    }

    const { friday, sunday } = getCurrentWeekendDates();

    // Check if picks are locked
    const { data: week } = await supabase
      .from("weeks")
      .select("*")
      .eq("start_date", friday)
      .eq("end_date", sunday)
      .single();

    if (week?.lock_time && new Date() >= new Date(week.lock_time)) {
      return NextResponse.json(
        { error: "Picks are locked! The first game has already started." },
        { status: 403 }
      );
    }

    const serviceSupabase = getServiceSupabase();

    // Upsert each pick
    const upsertData = picks.map((p) => ({
      player_id,
      game_id: p.game_id,
      picked_team: p.picked_team,
    }));

    const { error } = await serviceSupabase.from("picks").upsert(upsertData, {
      onConflict: "player_id,game_id",
    });

    if (error) {
      return NextResponse.json(
        { error: `Failed to save picks: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, saved: picks.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request", details: String(error) },
      { status: 400 }
    );
  }
}
