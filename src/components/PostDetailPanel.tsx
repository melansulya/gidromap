"use client";

import { useMemo, useState } from "react";
import { hydroposts, getHydropostHistory, analyzeLowWaterRisk } from "@/lib/akmolaMapData";
import type { HydropostHistoryEntry, LowWaterRiskEntry } from "@/lib/akmolaMapData";

interface Props {
  postCode: number | null;
  onClose: () => void;
}

const STATUS = {
  danger:  { color: "#ef4444", bg: "#ef444415", border: "#ef444438", label: "Опасный уровень" },
  warning: { color: "#f59e0b", bg: "#f59e0b15", border: "#f59e0b38", label: "Предупреждение"  },
  normal:  { color: "#22c55e", bg: "#22c55e15", border: "#22c55e38", label: "Норма"           },
} as const;

export function PostDetailPanel({ postCode, onClose }: Props) {
  const post  = useMemo(() => hydroposts.find((p) => p.code === postCode) ?? null, [postCode]);
  const hist  = useMemo(() => (post ? getHydropostHistory(post.code) : null), [post]);
  const [tab, setTab] = useState<"monitor" | "lowwater">("monitor");

  if (!post) return null;

  const sc         = STATUS[post.status];
  const allRows    = hist?.history ?? [];
  const validRows  = allRows.filter((h) => h.openWaterHighCm != null);
  const rangeRows  = validRows.filter((h) => h.openWaterLowCm != null);

  return (
    <div style={s.panel} className="detail-panel-in">
      {/* ── Header ── */}
      <div style={s.header}>
        <span style={{ ...s.dot, background: sc.color }} />
        <div style={s.headerText}>
          <div style={s.postName}>{post.label}</div>
          <div style={s.postMeta}>{post.waterBody} · {post.district}</div>
        </div>
        <button onClick={onClose} style={s.closeBtn} aria-label="Закрыть">×</button>
      </div>

      {/* ── Tabs ── */}
      <div style={s.tabBar}>
        <TabBtn label="Мониторинг" active={tab === "monitor"} onClick={() => setTab("monitor")} />
        <TabBtn label="Маловодье" active={tab === "lowwater"} onClick={() => setTab("lowwater")} />
      </div>

      {/* ── Monitor tab ── */}
      {tab === "monitor" && (
        <>
          <Section title="Текущий уровень">
            {post.hasLevelData ? (
              <>
                <div style={s.levelRow}>
                  <span style={{ ...s.badge, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {sc.label}
                  </span>
                  <span style={{ color: sc.color, fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                    {post.waterLevel}
                    <span style={{ fontSize: 11, color: "#8b949e", marginLeft: 3, fontWeight: 400 }}>см</span>
                  </span>
                </div>
                <GaugeBar level={post.waterLevel} status={post.status} />
                <div style={s.gaugeLabels}>
                  <span>0</span>
                  <span style={{ color: "#f59e0b" }}>порог</span>
                  <span style={{ color: "#ef4444" }}>опасно</span>
                </div>
              </>
            ) : (
              <div style={s.noData}>Нет данных</div>
            )}
          </Section>

          {validRows.length > 0 && (
            <Section title="Динамика уровней по годам">
              <BarChart rows={validRows} />
              <ChartLegend />
            </Section>
          )}

          {rangeRows.length > 0 && (
            <Section title="Диапазон водного периода">
              <RangeChart rows={rangeRows} />
              <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                <LegendItem color="#60a5fa" label="Максимум" />
                <LegendItem color="#1d4ed8" label="Диапазон" />
                <LegendItem color="#3b82f6" label="Минимум" />
              </div>
            </Section>
          )}

          {hist && (
            <Section title="Статистика наблюдений">
              <StatRow label="Лет наблюдений"    value={`${hist.stats.years} лет`} />
              {hist.stats.peakOpenWaterCm != null && (
                <StatRow label="Пик (откр. вода)" value={`${hist.stats.peakOpenWaterCm} см`} color="#60a5fa" />
              )}
              {hist.stats.peakYearCm != null && (
                <StatRow label="Пик (годовой)"    value={`${hist.stats.peakYearCm} см`} color="#fb923c" />
              )}
              {hist.stats.lowestOpenWaterCm != null && (
                <StatRow label="Минимум"           value={`${hist.stats.lowestOpenWaterCm} см`} color="#6ee7b7" />
              )}
            </Section>
          )}

          {!hist && (
            <div style={s.noData}>История наблюдений для этого поста недоступна</div>
          )}
        </>
      )}

      {/* ── Low water tab ── */}
      {tab === "lowwater" && <LowWaterTab postCode={post.code} />}

      <div style={s.footer}>Код поста: {post.code}</div>
    </div>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────────── */

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
        color: active ? "#e6edf3" : "#6e7681",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        padding: "7px 14px 5px",
        transition: "color 0.15s",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

const RISK_COLOR = { normal: "#22c55e", moderate: "#f59e0b", high: "#ef4444" } as const;
const RISK_LABEL = { normal: "Норма", moderate: "Умеренный риск", high: "Высокий риск" } as const;

function LowWaterTab({ postCode }: { postCode: number }) {
  const analysis = useMemo(() => analyzeLowWaterRisk(postCode), [postCode]);

  if (!analysis) {
    return <div style={s.noData}>История наблюдений для этого поста недоступна</div>;
  }
  if (!analysis.hasSufficientData) {
    return <div style={s.noData}>Недостаточно данных для анализа (нужно минимум 3 года с данными по низшему уровню)</div>;
  }

  const lastRisk = analysis.lastRisk ?? "normal";

  return (
    <>
      <Section title="Оценка маловодья">
        <div style={s.statRow}>
          <span style={s.statLabel}>Норма (медиана)</span>
          <span style={{ ...s.statValue }}>{Math.round(analysis.norm)} см</span>
        </div>
        <div style={{ ...s.statRow, borderBottom: "none" }}>
          <span style={s.statLabel}>Последний год в данных</span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: RISK_COLOR[lastRisk],
            background: `${RISK_COLOR[lastRisk]}18`,
            border: `1px solid ${RISK_COLOR[lastRisk]}40`,
            borderRadius: 5,
            padding: "2px 8px",
          }}>
            {RISK_LABEL[lastRisk]}
          </span>
        </div>
        {analysis.highRiskYears.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#6e7681" }}>
            Маловодные годы:{" "}
            <span style={{ color: "#ef4444", fontWeight: 600 }}>
              {analysis.highRiskYears.join(", ")}
            </span>
          </div>
        )}
        {analysis.highRiskYears.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#6e7681" }}>
            Маловодных лет в ряду не выявлено
          </div>
        )}
      </Section>

      <Section title="Минимум открытой воды по годам">
        <LowWaterChart entries={analysis.entries} />
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
          <LegendItem color="#22c55e" label="Норма" />
          <LegendItem color="#f59e0b" label="Умеренный" />
          <LegendItem color="#ef4444" label="Высокий" />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <svg width={18} height={8}>
              <line x1={0} y1={4} x2={18} y2={4} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
            </svg>
            <span style={{ fontSize: 10, color: "#8b949e" }}>Норма</span>
          </div>
        </div>
      </Section>
    </>
  );
}

function LowWaterChart({ entries }: { entries: LowWaterRiskEntry[] }) {
  const W = 272, H = 110;
  const PL = 34, PR = 6, PT = 8, PB = 22;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const norm = entries[0]?.norm ?? 0;
  const allVals = [...entries.map((e) => e.lowCm), norm];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const span = Math.max(maxV - minV, 1);
  const slotW = cW / entries.length;
  const bW = Math.max(8, slotW * 0.62);
  const bottomY = PT + cH;

  const yFor = (v: number) => PT + cH * (1 - (v - minV) / span);
  const normY = yFor(norm);

  const ticks = [minV, minV + span * 0.5, maxV];

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      {ticks.map((v, i) => {
        const y = yFor(v);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={PL + cW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={PL - 3} y={y + 3} textAnchor="end" fontSize={9} fill="#6e7681">{Math.round(v)}</text>
          </g>
        );
      })}

      <line x1={PL} y1={normY} x2={PL + cW} y2={normY}
        stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />

      {entries.map((e, i) => {
        const cx = PL + i * slotW + (slotW - bW) / 2;
        const yTop = yFor(e.lowCm);
        const barH = Math.max(2, bottomY - yTop);
        return (
          <g key={e.year}>
            <rect x={cx} y={yTop} width={bW} height={barH}
              fill={RISK_COLOR[e.risk]} fillOpacity={0.75} rx={2} />
            {shouldLabel(i, entries.length) && (
              <text x={cx + bW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#6e7681">
                {String(e.year).slice(2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={s.statRow}>
      <span style={s.statLabel}>{label}</span>
      <span style={{ ...s.statValue, color: color ?? "#e6edf3" }}>{value}</span>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 10, color: "#8b949e" }}>{label}</span>
    </div>
  );
}

function ChartLegend() {
  return (
    <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
      <LegendItem color="#3b82f6" label="Откр. вода (макс)" />
      <LegendItem color="#f59e0b" label="Пик года" />
    </div>
  );
}

function GaugeBar({ level, status }: { level: number; status: "normal" | "warning" | "danger" }) {
  const max = Math.max(level * 1.5, 300);
  const pct = Math.min(100, (level / max) * 100);
  const warnPct = Math.min(100, (0.55 * max / max) * 100);
  const dangerPct = Math.min(100, (0.78 * max / max) * 100);
  const color = status === "danger" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ position: "relative", background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 10, marginTop: 8, overflow: "hidden" }}>
      {/* zone ticks */}
      <div style={{ position: "absolute", left: `${warnPct}%`, top: 0, bottom: 0, width: 1, background: "#f59e0b50", zIndex: 1 }} />
      <div style={{ position: "absolute", left: `${dangerPct}%`, top: 0, bottom: 0, width: 1, background: "#ef444450", zIndex: 1 }} />
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.4s ease" }} />
    </div>
  );
}

// With long histories (40+ years) a label per bar overlaps into an unreadable
// smear, so only show enough labels to stay legible (always including the last
// year), spaced evenly.
function shouldLabel(i: number, count: number, maxLabels = 12): boolean {
  const step = Math.max(1, Math.ceil(count / maxLabels));
  return i % step === 0 || i === count - 1;
}

/* ── Bar chart ────────────────────────────────────────────────────────────── */

function BarChart({ rows }: { rows: HydropostHistoryEntry[] }) {
  const W = 272, H = 120;
  const PL = 34, PR = 6, PT = 10, PB = 22;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const slotW = cW / rows.length;
  const b1W = Math.max(5, slotW * 0.44);
  const b2W = Math.max(3, slotW * 0.26);

  const maxVal = Math.max(
    ...rows.flatMap((h) => [h.openWaterHighCm ?? 0, h.highestYearCm ?? 0]),
    1,
  );

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      {gridLines.map((f) => {
        const y = PT + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={PL} y1={y} x2={PL + cW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            {f > 0 && (
              <text x={PL - 3} y={y + 3} textAnchor="end" fontSize={9} fill="#6e7681">
                {Math.round(maxVal * f)}
              </text>
            )}
          </g>
        );
      })}

      {rows.map((h, i) => {
        const x = PL + i * slotW + 2;
        const owH  = h.openWaterHighCm != null ? (h.openWaterHighCm / maxVal) * cH : 0;
        const pkH  = h.highestYearCm   != null ? (h.highestYearCm   / maxVal) * cH : 0;

        return (
          <g key={h.year}>
            {h.openWaterHighCm != null && (
              <rect x={x} y={PT + cH - owH} width={b1W} height={owH} fill="#3b82f6" fillOpacity={0.85} rx={2} />
            )}
            {h.highestYearCm != null && (
              <rect x={x + b1W + 2} y={PT + cH - pkH} width={b2W} height={pkH} fill="#f59e0b" fillOpacity={0.75} rx={1} />
            )}
            {shouldLabel(i, rows.length) && (
              <text x={x + slotW / 2 - 1} y={H - 5} textAnchor="middle" fontSize={9} fill="#6e7681">
                {String(h.year).slice(2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Range chart ──────────────────────────────────────────────────────────── */

function RangeChart({ rows }: { rows: HydropostHistoryEntry[] }) {
  const W = 272, H = 95;
  const PL = 34, PR = 6, PT = 8, PB = 20;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const slotW = cW / rows.length;
  const bW = Math.max(8, slotW * 0.55);

  const allVals = rows.flatMap((h) => [h.openWaterHighCm!, h.openWaterLowCm!]);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const span = maxV - minV || 1;

  const yFor = (v: number) => PT + cH * (1 - (v - minV) / span);

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      {[0, 0.5, 1].map((f) => {
        const v = minV + span * f;
        const y = yFor(v);
        return (
          <g key={f}>
            <line x1={PL} y1={y} x2={PL + cW} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
            <text x={PL - 3} y={y + 3} textAnchor="end" fontSize={9} fill="#6e7681">
              {Math.round(v)}
            </text>
          </g>
        );
      })}

      {rows.map((h, i) => {
        const cx   = PL + i * slotW + (slotW - bW) / 2;
        const yHi  = yFor(h.openWaterHighCm!);
        const yLo  = yFor(h.openWaterLowCm!);
        const barH = Math.max(2, yLo - yHi);

        return (
          <g key={h.year}>
            <rect x={cx} y={yHi} width={bW} height={barH} fill="#1d4ed8" fillOpacity={0.45} rx={3} />
            <line x1={cx} y1={yHi} x2={cx + bW} y2={yHi} stroke="#60a5fa" strokeWidth={2} strokeLinecap="round" />
            <line x1={cx} y1={yLo} x2={cx + bW} y2={yLo} stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" />
            {shouldLabel(i, rows.length) && (
              <text x={cx + bW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#6e7681">
                {String(h.year).slice(2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────────── */

const s = {
  panel: {
    width: 320,
    height: "100%",
    background: "rgba(13, 17, 23, 0.93)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    scrollbarWidth: "thin" as const,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "14px 14px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    position: "sticky" as const,
    top: 0,
    background: "rgba(13,17,23,0.97)",
    zIndex: 2,
    borderRadius: "14px 14px 0 0",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    marginTop: 5,
    flexShrink: 0,
    boxShadow: "0 0 6px currentColor",
  },
  headerText:   { flex: 1, minWidth: 0 },
  postName:     { fontSize: 14, fontWeight: 700, color: "#e6edf3", lineHeight: 1.3, wordBreak: "break-word" as const },
  postMeta:     { fontSize: 11, color: "#6e7681", marginTop: 3 },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#6e7681",
    fontSize: 22,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
    marginTop: -2,
  },
  tabBar: {
    display: "flex",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    padding: "0 6px",
    flexShrink: 0,
  },
  section: {
    padding: "12px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#6e7681",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginBottom: 10,
  },
  levelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 5,
    padding: "2px 8px",
  },
  gaugeLabels: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#484f58",
    marginTop: 4,
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "5px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  statLabel: { fontSize: 12, color: "#6e7681" },
  statValue: { fontSize: 12, fontWeight: 600, color: "#e6edf3" },
  noData: {
    padding: "20px 16px",
    fontSize: 13,
    color: "#484f58",
    textAlign: "center" as const,
  },
  footer: {
    padding: "10px 14px",
    fontSize: 10,
    color: "#484f58",
    textAlign: "center" as const,
    marginTop: "auto",
  },
} as const;
