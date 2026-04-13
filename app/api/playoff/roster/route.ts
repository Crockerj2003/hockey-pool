import { NextRequest, NextResponse } from "next/server";
import { fetchTeamRoster } from "@/lib/nhl-playoff";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const team = request.nextUrl.searchParams.get("team")?.trim().toUpperCase();
  if (!team || team.length < 2 || team.length > 4) {
    return NextResponse.json({ error: "Invalid team" }, { status: 400 });
  }

  try {
    const roster = await fetchTeamRoster(team);
    return NextResponse.json({ roster });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Roster fetch failed" },
      { status: 502 }
    );
  }
}
