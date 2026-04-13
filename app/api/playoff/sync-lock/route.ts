import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";
import { findFirstPlayoffPuckDropUtc } from "@/lib/nhl-playoff";

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
  const { data: settings } = await supabase
    .from("playoff_settings")
    .select("id, bracket_calendar_year")
    .limit(1)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json({ error: "No playoff settings row" }, { status: 500 });
  }

  const year = settings.bracket_calendar_year;
  const from = `${year}-04-01`;
  const to = `${year}-07-15`;

  const first = await findFirstPlayoffPuckDropUtc(from, to);

  if (!first) {
    return NextResponse.json({
      success: false,
      message: "No playoff games (gameType 3) found in the scanned window.",
    });
  }

  const { error } = await supabase
    .from("playoff_settings")
    .update({ picks_lock_at: first })
    .eq("id", settings.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, picks_lock_at: first });
}
