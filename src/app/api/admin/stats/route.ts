import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabaseServer";

type Row = { action: string; details: Record<string, unknown> | null };

const EMPTY = { topHydroposts: [], topWaterObjects: [], chatQueries: 0, logins: 0, totalWarningViews: 0 };

export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const secret = process.env.AUTH_SECRET;
  if (!token || !secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await verifyJWT(token, secret);
  if (!payload || payload.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = getAdminClient();
    const { data, error } = await db
      .from("activity_log")
      .select("action, details")
      .in("action", ["view_hydropost", "view_water_object", "chat_query", "login"])
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      console.error("[admin/stats]", error);
      return NextResponse.json({ error: "Не удалось загрузить статистику" }, { status: 500 });
    }

    const rows = (data ?? []) as Row[];
    const hydropostCounts = new Map<string, { label: string; district: string; count: number; warnings: number }>();
    const waterCounts = new Map<string, { name: string; count: number }>();
    let chatQueries = 0;
    let logins = 0;

    for (const row of rows) {
      const d = row.details ?? {};
      if (row.action === "view_hydropost") {
        const key = String(d.code ?? d.label ?? "?");
        const entry = hydropostCounts.get(key) ?? {
          label: String(d.label ?? key),
          district: String(d.district ?? ""),
          count: 0,
          warnings: 0,
        };
        entry.count++;
        if (d.status === "warning" || d.status === "danger") entry.warnings++;
        hydropostCounts.set(key, entry);
      } else if (row.action === "view_water_object") {
        const key = String(d.id ?? d.name ?? "?");
        const entry = waterCounts.get(key) ?? { name: String(d.name ?? key), count: 0 };
        entry.count++;
        waterCounts.set(key, entry);
      } else if (row.action === "chat_query") {
        chatQueries++;
      } else if (row.action === "login") {
        logins++;
      }
    }

    const allHydroposts = [...hydropostCounts.values()];
    const topHydroposts = allHydroposts.slice().sort((a, b) => b.count - a.count).slice(0, 10);
    const topWaterObjects = [...waterCounts.values()].sort((a, b) => b.count - a.count).slice(0, 10);
    const totalWarningViews = allHydroposts.reduce((sum, e) => sum + e.warnings, 0);

    return NextResponse.json({ topHydroposts, topWaterObjects, chatQueries, logins, totalWarningViews });
  } catch {
    return NextResponse.json(EMPTY);
  }
}
