import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;
  const token = authHeader?.replace("Bearer ", "");
  return token === adminPassword;
}

/** PATCH body: { picks_lock_at: string | null } ISO datetime or null to clear */
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const raw = body.picks_lock_at as string | null | undefined;

    const supabase = getServiceSupabase();
    const { data: settings } = await supabase
      .from("playoff_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return NextResponse.json({ error: "No playoff settings" }, { status: 500 });
    }

    let nextLock: string | null;
    if (raw === null || raw === undefined || raw === "") {
      nextLock = null;
    } else {
      nextLock = raw;
    }

    const update = { picks_lock_at: nextLock };

    const { data, error } = await supabase
      .from("playoff_settings")
      .update(update)
      .eq("id", settings.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}
