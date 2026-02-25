import { NextRequest, NextResponse } from "next/server";
import { supabase, getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/players?all=true to include inactive players
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const includeAll = searchParams.get("all") === "true";

  let query = supabase.from("players").select("*");
  if (!includeAll) {
    query = query.eq("is_active", true);
  }
  const { data: players, error } = await query.order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch players" },
      { status: 500 }
    );
  }

  return NextResponse.json({ players: players || [] });
}

// POST /api/players - Add a new player (admin only)
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.replace("Bearer ", "") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const serviceSupabase = getServiceSupabase();
    const { data, error } = await serviceSupabase
      .from("players")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A player with that name already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ player: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// PATCH /api/players - Toggle player active status (admin only)
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.replace("Bearer ", "") !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, is_active } = await request.json();
    const serviceSupabase = getServiceSupabase();

    const { data, error } = await serviceSupabase
      .from("players")
      .update({ is_active })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ player: data });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
