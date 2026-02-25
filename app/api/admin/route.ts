import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// POST /api/admin - Verify admin password
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

// PATCH /api/admin - Override a game winner (admin only)
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.replace("Bearer ", "") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { game_id, winner } = await request.json();
    const serviceSupabase = getServiceSupabase();

    // Update the game winner and status
    const { error: gameError } = await serviceSupabase
      .from("games")
      .update({ winner, status: "final" })
      .eq("id", game_id);

    if (gameError) {
      return NextResponse.json(
        { error: gameError.message },
        { status: 500 }
      );
    }

    // Update picks correctness
    if (winner) {
      await serviceSupabase
        .from("picks")
        .update({ is_correct: true })
        .eq("game_id", game_id)
        .eq("picked_team", winner);

      await serviceSupabase
        .from("picks")
        .update({ is_correct: false })
        .eq("game_id", game_id)
        .neq("picked_team", winner);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
