"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "akim" | "deputy";
  source: "env" | "db";
  created_at: string | null;
};

type ActivityRow = {
  id: number;
  user_email: string;
  user_name: string | null;
  user_role: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

type Stats = {
  topHydroposts: { label: string; district: string; count: number; warnings: number }[];
  topWaterObjects: { name: string; count: number }[];
  chatQueries: number;
  logins: number;
  totalWarningViews: number;
};

const ROLE_LABELS = { admin: "Администратор", akim: "Аким", deputy: "Зам. акима" };
const ROLE_COLORS = {
  admin:  { bg: "#ef444420", color: "#ef4444", border: "#ef444440" },
  akim:   { bg: "#1f6feb20", color: "#60a5fa", border: "#1f6feb40" },
  deputy: { bg: "#22c55e20", color: "#22c55e", border: "#22c55e40" },
};

const ACTION_LABELS: Record<string, string> = {
  login: "Вход в систему",
  chat_query: "Запрос к ИИ",
  view_hydropost: "Просмотр гидропоста",
  view_water_object: "Просмотр водного объекта",
  measure_distance: "Измерение линейкой",
  water_trace: "Водный след",
  export_doc: "Экспорт файла",
  switch_region: "Смена региона",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function summarizeDetails(row: ActivityRow): string {
  const d = row.details ?? {};
  if (row.action === "view_hydropost") return `${d.label ?? "?"} (${d.district ?? ""})${d.status === "warning" || d.status === "danger" ? " ⚠" : ""}`;
  if (row.action === "view_water_object") return String(d.name ?? "?");
  if (row.action === "chat_query") return String(d.query ?? "");
  if (row.action === "measure_distance") return `${d.objectName ?? "?"} — ${d.distanceKm ? Number(d.distanceKm).toFixed(2) : "?"} км`;
  if (row.action === "water_trace") {
    return d.connected
      ? `${d.labelA ?? "?"} → ${d.labelB ?? "?"} — ${d.distanceKm ? Number(d.distanceKm).toFixed(2) : "?"} км`
      : `${d.labelA ?? "?"} → ${d.labelB ?? "?"} — нет соединения`;
  }
  if (row.action === "export_doc") return `.${d.format ?? "?"} (${d.scope === "chat" ? "весь диалог" : "ответ ИИ"})`;
  if (row.action === "switch_region") return d.region === "kyzylorda" ? "Кызылординская область" : "Акмолинская область";
  return "";
}

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"users" | "activity" | "chats" | "stats">("users");
  const [loading, setLoading] = useState(true);

  // Users tab
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole]         = useState<"akim" | "deputy">("deputy");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError]   = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Activity / chats tabs
  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [chats, setChats] = useState<ActivityRow[] | null>(null);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [expandedChat, setExpandedChat] = useState<number | null>(null);

  // Stats tab
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }

  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (!res.ok) { router.push("/login"); return; }
      const me = await res.json();
      if (me.role !== "admin") { router.push("/"); return; }
      await loadUsers();
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (tab === "activity" && activity === null) {
      setActivityLoading(true);
      fetch("/api/admin/activity?limit=200")
        .then((res) => res.json())
        .then((data) => setActivity(Array.isArray(data) ? data : []))
        .finally(() => setActivityLoading(false));
    }
    if (tab === "chats" && chats === null) {
      setChatsLoading(true);
      fetch("/api/admin/activity?action=chat_query&limit=200")
        .then((res) => res.json())
        .then((data) => setChats(Array.isArray(data) ? data : []))
        .finally(() => setChatsLoading(false));
    }
    if (tab === "stats" && stats === null) {
      setStatsLoading(true);
      fetch("/api/admin/stats")
        .then((res) => res.json())
        .then((data) => setStats(data))
        .finally(() => setStatsLoading(false));
    }
  }, [tab, activity, chats, stats]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, role }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? "Ошибка"); return; }
      setCreateSuccess(`Пользователь ${email} создан`);
      setName(""); setEmail(""); setPassword(""); setRole("deputy");
      await loadUsers();
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Удалить ${user.name} (${user.email})?`)) return;
    setDeletingId(user.id);
    try {
      await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id }),
      });
      await loadUsers();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div style={s.page}><span style={{ color: "#484f58" }}>Загрузка...</span></div>;
  }

  return (
    <div style={s.page}>
      <div style={s.container}>

        <div style={s.header}>
          <span style={s.badge}>AI Gidromap</span>
          <span style={s.title}>Панель администратора</span>
          <a href="/" style={s.backBtn}>← На карту</a>
        </div>

        <div style={s.tabBar}>
          <TabBtn label="Пользователи" active={tab === "users"} onClick={() => setTab("users")} />
          <TabBtn label="Активность" active={tab === "activity"} onClick={() => setTab("activity")} />
          <TabBtn label="Чаты" active={tab === "chats"} onClick={() => setTab("chats")} />
          <TabBtn label="Статистика" active={tab === "stats"} onClick={() => setTab("stats")} />
        </div>

        {tab === "users" && (
          <>
            <div style={s.card}>
              <h2 style={s.cardTitle}>Создать аккаунт</h2>
              <form onSubmit={handleCreate} style={s.form}>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Полное имя</label>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Иванов Иван Иванович" required style={s.input} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.kz" required style={s.input} />
                  </div>
                </div>
                <div style={s.row}>
                  <div style={s.field}>
                    <label style={s.label}>Пароль</label>
                    <div style={s.passwordWrap}>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Минимум 6 символов"
                        required
                        minLength={6}
                        style={s.passwordInput}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        style={s.eyeBtn}
                        tabIndex={-1}
                        aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                      >
                        {showPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Роль</label>
                    <select value={role} onChange={(e) => setRole(e.target.value as "akim" | "deputy")} style={{ ...s.input, cursor: "pointer" }}>
                      <option value="akim">Аким</option>
                      <option value="deputy">Зам. акима</option>
                    </select>
                  </div>
                </div>
                {createError   && <p style={s.error}>{createError}</p>}
                {createSuccess && <p style={s.success}>{createSuccess}</p>}
                <button type="submit" disabled={creating} style={s.btn}>
                  {creating ? "Создание..." : "Создать аккаунт"}
                </button>
              </form>
            </div>

            <div style={s.card}>
              <h2 style={s.cardTitle}>Пользователи ({users.length})</h2>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Имя</th>
                      <th style={s.th}>Email</th>
                      <th style={s.th}>Роль</th>
                      <th style={s.th}>Добавлен</th>
                      <th style={s.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => {
                      const c = ROLE_COLORS[u.role];
                      return (
                        <tr key={u.id}>
                          <td style={s.td}>{u.name || "—"}</td>
                          <td style={s.td}>{u.email}</td>
                          <td style={s.td}>
                            <span style={{ ...s.roleBadge, background: c.bg, color: c.color, borderColor: c.border }}>
                              {ROLE_LABELS[u.role]}
                            </span>
                          </td>
                          <td style={{ ...s.td, color: "#484f58", fontSize: 12 }}>
                            {u.source === "env" ? "Системный" : u.created_at ? new Date(u.created_at).toLocaleDateString("ru-RU") : "—"}
                          </td>
                          <td style={s.td}>
                            {u.source === "db" && (
                              <button
                                onClick={() => handleDelete(u)}
                                disabled={deletingId === u.id}
                                style={s.deleteBtn}
                              >
                                {deletingId === u.id ? "..." : "Удалить"}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "activity" && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>Журнал активности {activity ? `(${activity.length})` : ""}</h2>
            {activityLoading && <span style={{ color: "#484f58", fontSize: 13 }}>Загрузка...</span>}
            {!activityLoading && activity && activity.length === 0 && (
              <span style={{ color: "#484f58", fontSize: 13 }}>Пока нет записей активности.</span>
            )}
            {!activityLoading && activity && activity.length > 0 && (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Время</th>
                      <th style={s.th}>Пользователь</th>
                      <th style={s.th}>Роль</th>
                      <th style={s.th}>Действие</th>
                      <th style={s.th}>Детали</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.map((row) => {
                      const c = row.user_role && row.user_role in ROLE_COLORS ? ROLE_COLORS[row.user_role as keyof typeof ROLE_COLORS] : null;
                      return (
                        <tr key={row.id}>
                          <td style={{ ...s.td, color: "#484f58", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(row.created_at)}</td>
                          <td style={s.td}>{row.user_name || row.user_email}</td>
                          <td style={s.td}>
                            {c && (
                              <span style={{ ...s.roleBadge, background: c.bg, color: c.color, borderColor: c.border }}>
                                {ROLE_LABELS[row.user_role as keyof typeof ROLE_LABELS]}
                              </span>
                            )}
                          </td>
                          <td style={s.td}>{ACTION_LABELS[row.action] ?? row.action}</td>
                          <td style={{ ...s.td, color: "#8b949e", fontSize: 12, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={summarizeDetails(row)}>
                            {summarizeDetails(row)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "chats" && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>История запросов к ИИ {chats ? `(${chats.length})` : ""}</h2>
            {chatsLoading && <span style={{ color: "#484f58", fontSize: 13 }}>Загрузка...</span>}
            {!chatsLoading && chats && chats.length === 0 && (
              <span style={{ color: "#484f58", fontSize: 13 }}>Пока нет запросов.</span>
            )}
            {!chatsLoading && chats && chats.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chats.map((row) => {
                  const d = row.details ?? {};
                  const expanded = expandedChat === row.id;
                  return (
                    <div key={row.id} style={s.chatRow} onClick={() => setExpandedChat(expanded ? null : row.id)}>
                      <div style={s.chatRowHead}>
                        <span style={{ color: "#e6edf3", fontSize: 13, fontWeight: 600 }}>{row.user_name || row.user_email}</span>
                        <span style={{ color: "#484f58", fontSize: 11 }}>{fmtDate(row.created_at)}</span>
                      </div>
                      <div style={{ color: "#c9d1d9", fontSize: 13, marginTop: 4 }}>{String(d.query ?? "")}</div>
                      {expanded && (
                        <div style={s.chatAnswer}>{String(d.answer ?? "")}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "stats" && (
          <>
            <div style={s.statRow}>
              <StatCard label="Входов в систему" value={stats?.logins ?? 0} />
              <StatCard label="Запросов к ИИ" value={stats?.chatQueries ?? 0} />
              <StatCard label="Просмотров с предупреждением" value={stats?.totalWarningViews ?? 0} accent="#f59e0b" />
            </div>
            {statsLoading && <span style={{ color: "#484f58", fontSize: 13 }}>Загрузка...</span>}
            {!statsLoading && stats && (
              <>
                <div style={s.card}>
                  <h2 style={s.cardTitle}>Топ гидропостов по просмотрам</h2>
                  {stats.topHydroposts.length === 0
                    ? <span style={{ color: "#484f58", fontSize: 13 }}>Нет данных.</span>
                    : (
                      <div style={s.tableWrap}>
                        <table style={s.table}>
                          <thead><tr><th style={s.th}>Гидропост</th><th style={s.th}>Район</th><th style={s.th}>Просмотры</th><th style={s.th}>С предупреждением</th></tr></thead>
                          <tbody>
                            {stats.topHydroposts.map((h, i) => (
                              <tr key={i}>
                                <td style={s.td}>{h.label}</td>
                                <td style={{ ...s.td, color: "#8b949e", fontSize: 12 }}>{h.district}</td>
                                <td style={s.td}>{h.count}</td>
                                <td style={{ ...s.td, color: h.warnings > 0 ? "#f59e0b" : "#484f58" }}>{h.warnings}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
                <div style={s.card}>
                  <h2 style={s.cardTitle}>Топ водных объектов по просмотрам</h2>
                  {stats.topWaterObjects.length === 0
                    ? <span style={{ color: "#484f58", fontSize: 13 }}>Нет данных.</span>
                    : (
                      <div style={s.tableWrap}>
                        <table style={s.table}>
                          <thead><tr><th style={s.th}>Объект</th><th style={s.th}>Просмотры</th></tr></thead>
                          <tbody>
                            {stats.topWaterObjects.map((w, i) => (
                              <tr key={i}>
                                <td style={s.td}>{w.name}</td>
                                <td style={s.td}>{w.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...s.tabBtn, ...(active ? s.tabBtnActive : {}) }}>
      {label}
    </button>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={s.statCard}>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? "#e6edf3" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8b949e" }}>{label}</div>
    </div>
  );
}

const s = {
  page: { minHeight: "100dvh", background: "#0d1117", padding: 24, display: "flex", justifyContent: "center" },
  container: { width: "100%", maxWidth: 920, display: "flex", flexDirection: "column" as const, gap: 20 },
  header: { display: "flex", alignItems: "center", gap: 12 },
  badge: { background: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e40", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const },
  title: { fontSize: 18, fontWeight: 700, color: "#e6edf3", flex: 1 },
  backBtn: { fontSize: 13, color: "#8b949e", padding: "5px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, textDecoration: "none" },
  tabBar: { display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: 2 },
  tabBtn: { background: "none", border: "none", color: "#8b949e", fontSize: 13, fontWeight: 600, padding: "8px 14px", cursor: "pointer", fontFamily: "inherit", borderRadius: 8, borderBottom: "2px solid transparent" },
  tabBtnActive: { color: "#e6edf3", borderBottom: "2px solid #1f6feb" },
  card: { background: "#161b22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "20px 24px" },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#e6edf3", marginBottom: 16 },
  form: { display: "flex", flexDirection: "column" as const, gap: 12 },
  row: { display: "flex", gap: 12, flexWrap: "wrap" as const },
  field: { flex: "1 1 200px", display: "flex", flexDirection: "column" as const, gap: 5 },
  label: { fontSize: 12, color: "#8b949e", fontWeight: 500 },
  input: { background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e6edf3", fontSize: 13, padding: "8px 12px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" as const },
  passwordWrap: { position: "relative" as const, width: "100%" },
  passwordInput: { background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e6edf3", fontSize: 13, padding: "8px 40px 8px 12px", outline: "none", fontFamily: "inherit", width: "100%", boxSizing: "border-box" as const },
  eyeBtn: { position: "absolute" as const, right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#6e7681", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", justifyContent: "center" },
  error:   { fontSize: 12, color: "#ef4444", padding: "6px 10px", background: "#ef444410", border: "1px solid #ef444430", borderRadius: 6 },
  success: { fontSize: 12, color: "#22c55e", padding: "6px 10px", background: "#22c55e10", border: "1px solid #22c55e30", borderRadius: 6 },
  btn: { alignSelf: "flex-start" as const, background: "#1f6feb", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, padding: "9px 20px", cursor: "pointer", fontFamily: "inherit" },
  tableWrap: { overflowX: "auto" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "8px 12px", color: "#8b949e", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap" as const },
  td: { padding: "10px 12px", color: "#c9d1d9", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  roleBadge: { display: "inline-block" as const, border: "1px solid", borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 },
  deleteBtn: { fontSize: 11, color: "#ef4444", background: "#ef444412", border: "1px solid #ef444430", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" },
  chatRow: { background: "#0d1117", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 14px", cursor: "pointer" },
  chatRowHead: { display: "flex", justifyContent: "space-between" as const, alignItems: "center" },
  chatAnswer: { marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", color: "#8b949e", fontSize: 12, whiteSpace: "pre-wrap" as const },
  statRow: { display: "flex", gap: 14, flexWrap: "wrap" as const },
  statCard: { flex: "1 1 160px", background: "#161b22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px" },
} as const;
