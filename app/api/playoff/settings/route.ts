import { NextRequest, NextResponse } from "next/server";
import { supabase, getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;
  const token = authHeader?.replace("Bearer ", "");
  return token === adminPassword;
}

/** Public: read playoff settings (includes ui_enabled). */
export async function GET() {
  const { data, error } = await supabase
    .from("playoff_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

/** PATCH body: { picks_lock_at?: string | null, ui_enabled?: boolean } */
export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const supabaseAdmin = getServiceSupabase();
    const { data: settings } = await supabaseAdmin
      .from("playoff_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return NextResponse.json({ error: "No playoff settings" }, { status: 500 });
    }

    const update: Record<string, unknown> = {};

    if ("picks_lock_at" in body) {
      const raw = body.picks_lock_at as string | null | undefined;
      update.picks_lock_at =
        raw === null || raw === undefined || raw === "" ? null : raw;
    }

    if (typeof body.ui_enabled === "boolean") {
      update.ui_enabled = body.ui_enabled;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
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
