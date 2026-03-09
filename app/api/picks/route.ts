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

    // Get active week and check lock state
    const { data: week } = await supabase
      .from("weeks")
      .select("*")
      .eq("start_date", friday)
      .eq("end_date", sunday)
      .single();

    if (!week) {
      return NextResponse.json(
        { error: "No active weekend found. Sync games first." },
        { status: 400 }
      );
    }

    if (week?.lock_time && new Date() >= new Date(week.lock_time)) {
      return NextResponse.json(
        { error: "Picks are locked! The first game has already started." },
        { status: 403 }
      );
    }

    // Ensure submitted picks belong to games in this week.
    const { data: games } = await supabase
      .from("games")
      .select("id")
      .eq("week_id", week.id);

    const gameIds = (games || []).map((g) => g.id);
    const validGameIds = new Set(gameIds);

    if (gameIds.length === 0) {
      return NextResponse.json(
        { error: "No games found for this weekend." },
        { status: 400 }
      );
    }

    const hasInvalidGame = picks.some((p) => !validGameIds.has(p.game_id));
    if (hasInvalidGame) {
      return NextResponse.json(
        { error: "One or more picks are for invalid games." },
        { status: 400 }
      );
    }

    // Hard lock after first submission: no edits/updates.
    const { count: existingCount } = await supabase
      .from("picks")
      .select("*", { count: "exact", head: true })
      .eq("player_id", player_id)
      .in("game_id", gameIds);

    if ((existingCount || 0) > 0) {
      return NextResponse.json(
        { error: "Picks already submitted. Updates are not allowed." },
        { status: 409 }
      );
    }

    const serviceSupabase = getServiceSupabase();

    // Insert picks once for this weekend.
    const insertData = picks.map((p) => ({
      player_id,
      game_id: p.game_id,
      picked_team: p.picked_team,
    }));

    const { error } = await serviceSupabase.from("picks").insert(insertData);

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Picks already submitted. Updates are not allowed." },
          { status: 409 }
        );
      }
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
