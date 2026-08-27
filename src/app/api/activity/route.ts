import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromToken } from "@/lib/auth";
import { logActivity } from "@/lib/activityLog";

// Only client-triggered view events may be logged through this public endpoint.
// "login" and "chat_query" are server-generated only (login route, chat route) —
// allowing them here would let any authenticated user forge fake log entries
// and skew the admin stats/activity views.
const ActivityBodySchema = z.object({
  action: z.enum(["view_hydropost", "view_water_object", "measure_distance", "water_trace", "export_doc", "switch_region"]),
  details: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthFromToken(request.cookies.get("auth_token")?.value, process.env.AUTH_SECRET);
  if (!auth?.email) return NextResponse.json({ ok: false }, { status: 401 });

  const json = await request.json().catch(() => null);
  const parsed = ActivityBodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });

  await logActivity({
    email: auth.email,
    name: auth.name,
    role: auth.role,
    action: parsed.data.action,
    details: parsed.data.details,
  });

  return NextResponse.json({ ok: true });
}
