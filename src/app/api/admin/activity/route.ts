import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabaseServer";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, secret);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const limit = Math.min(Number(searchParams.get("limit") ?? 200) || 200, 500);

  try {
    const db = getAdminClient();
    let query = db.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
    if (action) query = query.eq("action", action);
    const { data, error } = await query;
    if (error) {
      console.error("[admin/activity]", error);
      return NextResponse.json({ error: "Не удалось загрузить активность" }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
