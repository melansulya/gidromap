import { getAdminClient } from "@/lib/supabaseServer";

export type ActivityAction =
  | "login"
  | "chat_query"
  | "view_hydropost"
  | "view_water_object"
  | "measure_distance"
  | "water_trace"
  | "export_doc";

export async function logActivity(entry: {
  email: string;
  name?: string | null;
  role?: string | null;
  action: ActivityAction;
  details?: Record<string, unknown>;
}) {
  try {
    const db = getAdminClient();
    await db.from("activity_log").insert({
      user_email: entry.email,
      user_name: entry.name ?? null,
      user_role: entry.role ?? null,
      action: entry.action,
      details: entry.details ?? {},
    });
  } catch (err) {
    // Best-effort logging — never break the request that triggered it
    console.error("[activityLog]", err);
  }
}
