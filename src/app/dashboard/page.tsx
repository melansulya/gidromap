"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hydroposts as allHydroposts, getHydropostHistory, analyzeLowWaterRisk } from "@/lib/akmolaMapData";
import type { WeatherPoint } from "@/app/api/weather/route";
import type { Region } from "@/lib/types";

const STATUS_COLOR = { normal: "#22c55e", warning: "#f59e0b", danger: "#ef4444" } as const;
const STATUS_LABEL = { normal: "Норма", warning: "Внимание", danger: "Опасно" } as const;
const RISK_COLOR = { normal: "#22c55e", moderate: "#f59e0b", high: "#ef4444" } as const;
const RISK_LABEL = { normal: "Норма", moderate: "Умеренный", high: "Высокий" } as const;
const REGION_LABEL: Record<Region, string> = { akmola: "Акмолинская область", kyzylorda: "Кызылординская область" };

type AuthUser = { email: string; name: string; role: "admin" | "akim" | "deputy" };

export default function DashboardPage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [region, setRegion] = useState<Region>("akmola");
  const [weather, setWeather] = useState<WeatherPoint[] | null>(null);
  const [weatherError, setWeatherError] = useState(false);

  const hydroposts = useMemo(() => allHydroposts.filter((p) => p.region === region), [region]);

  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (!res.ok) { router.push("/login"); return; }
      setAuthUser(await res.json());
    });
  }, [router]);

  useEffect(() => {
    setWeather(null);
    setWeatherError(false);
    fetch(`/api/weather?region=${region}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setWeather(data);
        else setWeatherError(true);
      })
      .catch(() => setWeatherError(true));
  }, [region]);

  // ── 1. Status summary ────────────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = { normal: 0, warning: 0, danger: 0, noData: 0 };
    for (const p of hydroposts) {
      if (!p.hasLevelData) counts.noData++;
      else counts[p.status]++;
    }
    return counts;
  }, [hydroposts]);

  // ── 2. Low-water risk across all posts ───────────────────────────────────
  const riskRows = useMemo(() => {
    return hydroposts
      .map((p) => {
        const analysis = analyzeLowWaterRisk(p.code);
        if (!analysis || !analysis.hasSufficientData) return null;
        const last = analysis.entries[analysis.entries.length - 1] ?? null;
        return {
          code: p.code, label: p.label, district: p.district,
          risk: analysis.lastRisk ?? "normal",
          deviationPct: last?.deviationPct ?? 0,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.deviationPct - b.deviationPct);
  }, [hydroposts]);
  const riskCounts = useMemo(() => {
    const counts = { normal: 0, moderate: 0, high: 0 };
    for (const r of riskRows) counts[r.risk]++;
    return counts;
  }, [riskRows]);

  // ── 3. Weather & snowmelt joined to posts by hydropost code ─────────────
  const weatherRows = useMemo(() => {
    if (!weather) return [];
    const byCode = new Map(weather.map((w) => [w.postCode, w]));
    return hydroposts
      .map((p) => ({ post: p, w: byCode.get(p.code) }))
      .filter((r): r is { post: (typeof hydroposts)[number]; w: WeatherPoint } => r.w !== undefined);
  }, [hydroposts, weather]);
  const topPrecip = useMemo(
    () => [...weatherRows].sort((a, b) => b.w.precip24h - a.w.precip24h).slice(0, 8),
    [weatherRows],
  );
  const snowmeltCounts = useMemo(() => {
    const counts = { none: 0, low: 0, moderate: 0, high: 0 };
    for (const r of weatherRows) counts[r.w.snowMeltLevel]++;
    return counts;
  }, [weatherRows]);

  // ── 4. Historical peak leaderboard ───────────────────────────────────────
  const peakRows = useMemo(() => {
    return hydroposts
      .map((p) => {
        const hist = getHydropostHistory(p.code);
        if (!hist) return null;
        const peak = hist.stats.peakYearCm ?? hist.stats.peakOpenWaterCm;
        if (peak == null) return null;
        const year = hist.history.find((h) => h.highestYearCm === peak || h.openWaterHighCm === peak)?.year ?? null;
        return { code: p.code, label: p.label, district: p.district, peak, year };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.peak - a.peak)
      .slice(0, 10);
  }, [hydroposts]);

  if (!authUser) {
    return <div style={s.loading}>Загрузка...</div>;
  }

  const totalPosts = hydroposts.length;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <a href="/" style={s.backLink}>← Карта</a>
        <span style={s.title}>Дашборд — сводка по региону</span>
        <div style={s.regionSwitch}>
          {(["akmola", "kyzylorda"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              style={{ ...s.regionBtn, ...(region === r ? s.regionBtnActive : {}) }}
            >
              {REGION_LABEL[r]}
            </button>
          ))}
        </div>
      </div>

      <div style={s.grid}>
        {/* 1. Status summary */}
        <Card title="Статус постов" subtitle={`${totalPosts} гидропостов`}>
          <StackedBar
            segments={[
              { value: statusCounts.normal, color: STATUS_COLOR.normal },
              { value: statusCounts.warning, color: STATUS_COLOR.warning },
              { value: statusCounts.danger, color: STATUS_COLOR.danger },
              { value: statusCounts.noData, color: "#484f58" },
            ]}
          />
          <div style={s.legendRow}>
            <LegendCount color={STATUS_COLOR.normal} label={STATUS_LABEL.normal} count={statusCounts.normal} />
            <LegendCount color={STATUS_COLOR.warning} label={STATUS_LABEL.warning} count={statusCounts.warning} />
            <LegendCount color={STATUS_COLOR.danger} label={STATUS_LABEL.danger} count={statusCounts.danger} />
            {statusCounts.noData > 0 && (
              <LegendCount color="#484f58" label="Нет данных" count={statusCounts.noData} />
            )}
          </div>
        </Card>

        {/* 2. Low-water risk */}
        <Card title="Риск маловодья" subtitle={`${riskRows.length} постов с достаточной историей`}>
          <StackedBar
            segments={[
              { value: riskCounts.normal, color: RISK_COLOR.normal },
              { value: riskCounts.moderate, color: RISK_COLOR.moderate },
              { value: riskCounts.high, color: RISK_COLOR.high },
            ]}
          />
          <div style={s.legendRow}>
            <LegendCount color={RISK_COLOR.normal} label={RISK_LABEL.normal} count={riskCounts.normal} />
            <LegendCount color={RISK_COLOR.moderate} label={RISK_LABEL.moderate} count={riskCounts.moderate} />
            <LegendCount color={RISK_COLOR.high} label={RISK_LABEL.high} count={riskCounts.high} />
          </div>
          {riskCounts.high > 0 && (
            <div style={s.list}>
              {riskRows.filter((r) => r.risk === "high").map((r) => (
                <div key={r.code} style={s.listRow}>
                  <span style={s.listLabel}>{r.label} <span style={s.listMeta}>· {r.district}</span></span>
                  <span style={{ ...s.listValue, color: RISK_COLOR.high }}>{r.deviationPct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 3. Weather & snowmelt */}
        <Card title="Погода и снеготаяние" subtitle="Осадки за 24ч и риск снеготаяния по региону">
          {weatherError && <div style={s.noData}>Не удалось загрузить погоду</div>}
          {!weatherError && !weather && <div style={s.noData}>Загрузка...</div>}
          {weather && (
            <>
              <div style={s.legendRow}>
                <LegendCount color="#f59e0b" label="Снеготаяние: умеренное" count={snowmeltCounts.moderate} />
                <LegendCount color="#ef4444" label="высокое" count={snowmeltCounts.high} />
              </div>
              <div style={{ ...s.list, marginTop: 8 }}>
                {topPrecip.map(({ post, w }) => (
                  <div key={post.code} style={s.listRow}>
                    <span style={s.listLabel}>{post.label} <span style={s.listMeta}>· {post.district}</span></span>
                    <MiniBar value={w.precip24h} max={topPrecip[0].w.precip24h || 1} color="#3b82f6" suffix=" мм" />
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* 4. Historical peaks */}
        <Card title="Исторические максимумы" subtitle="Топ-10 постов по наивысшему уровню за всю историю наблюдений">
          <div style={s.list}>
            {peakRows.map((r, i) => (
              <div key={r.code} style={s.listRow}>
                <span style={s.listLabel}>
                  <span style={s.rank}>{i + 1}</span> {r.label} <span style={s.listMeta}>· {r.district}{r.year ? `, ${r.year}` : ""}</span>
                </span>
                <span style={s.listValue}>{r.peak} см</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Small building blocks ─────────────────────────────────────────────────

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      {subtitle && <div style={s.cardSubtitle}>{subtitle}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function StackedBar({ segments }: { segments: { value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div style={s.stackedBar}>
      {segments.map((seg, i) => (
        seg.value > 0 && (
          <div key={i} style={{ width: `${(seg.value / total) * 100}%`, background: seg.color }} />
        )
      ))}
    </div>
  );
}

function LegendCount({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: "#8b949e" }}>{label}: <b style={{ color: "#e6edf3" }}>{count}</b></span>
    </div>
  );
}

function MiniBar({ value, max, color, suffix }: { value: number; max: number; color: string; suffix: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: 120 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, color: "#8b949e", width: 40, textAlign: "right" as const, flexShrink: 0 }}>
        {value}{suffix}
      </span>
    </div>
  );
}

const s = {
  loading: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0d1117", color: "#6e7681", fontSize: 14,
  },
  page: { minHeight: "100vh", background: "#0d1117", color: "#e6edf3", padding: "20px 24px 60px" },
  header: { display: "flex", alignItems: "center", gap: 16, marginBottom: 24 },
  regionSwitch: { display: "flex", gap: 6, marginLeft: "auto" },
  regionBtn: {
    padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)", color: "#8b949e", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  regionBtnActive: { background: "#1f6feb", border: "1px solid #1f6feb", color: "#fff" },
  backLink: { color: "#60a5fa", fontSize: 13, textDecoration: "none" },
  title: { fontSize: 18, fontWeight: 700 },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16,
    maxWidth: 1200,
  },
  card: {
    background: "#161b22", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12,
    padding: "16px 18px",
  },
  cardTitle: { fontSize: 14, fontWeight: 700, color: "#e6edf3" },
  cardSubtitle: { fontSize: 11.5, color: "#6e7681", marginTop: 2 },
  stackedBar: {
    display: "flex", height: 10, borderRadius: 6, overflow: "hidden",
    background: "rgba(255,255,255,0.06)",
  },
  legendRow: { display: "flex", gap: 14, flexWrap: "wrap" as const, marginTop: 10 },
  list: { display: "flex", flexDirection: "column" as const, gap: 6, marginTop: 10, maxHeight: 260, overflowY: "auto" as const },
  listRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    fontSize: 12, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  listLabel: { color: "#c9d1d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  listMeta: { color: "#6e7681" },
  listValue: { color: "#e6edf3", fontWeight: 600, flexShrink: 0 },
  rank: { color: "#6e7681", fontWeight: 400, marginRight: 2 },
  noData: { fontSize: 12, color: "#6e7681", padding: "8px 0" },
} as const;
