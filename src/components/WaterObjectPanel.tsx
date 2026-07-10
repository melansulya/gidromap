"use client";

import type { WaterObject } from "@/lib/types";
import { hydroposts } from "@/lib/akmolaMapData";
import { haversineKm } from "@/lib/measure";
import { getWaterPassport } from "@/lib/waterPassport";

type Props = {
  water: WaterObject;
  onClose: () => void;
};

const KIND_LABEL: Record<string, string> = {
  river: "Река",
  lake: "Озеро",
  reservoir: "Водохранилище",
};

const KIND_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  river:      { text: "#3b82f6", bg: "#3b82f615", border: "#3b82f638" },
  lake:       { text: "#06b6d4", bg: "#06b6d415", border: "#06b6d438" },
  reservoir:  { text: "#0d9488", bg: "#0d948815", border: "#0d948838" },
};

function normWaterBody(name: string) {
  return name.toLowerCase().replace(/^(р\.|оз\.|вдхр\.)\s*/i, "").trim();
}

export function WaterObjectPanel({ water, onClose }: Props) {
  const passport = getWaterPassport(water.name);
  const kc = KIND_COLOR[water.kind] ?? KIND_COLOR.river;

  let segLengthKm: number | null = null;
  if (water.geometry === "polyline") {
    const coords = water.coordinates as [number, number][];
    let len = 0;
    for (let i = 1; i < coords.length; i++) len += haversineKm(coords[i - 1], coords[i]);
    segLengthKm = len;
  }

  const norm = normWaterBody(water.name);
  const posts = hydroposts.filter((p) => {
    const pn = normWaterBody(p.waterBody);
    return pn === norm || pn.includes(norm) || norm.includes(pn);
  });

  return (
    <div style={s.panel} className="detail-panel-in">
      <div style={s.header}>
        <span style={{ ...s.kindBadge, color: kc.text, background: kc.bg, border: `1px solid ${kc.border}` }}>
          {KIND_LABEL[water.kind] ?? water.kind}
        </span>
        <button onClick={onClose} style={s.closeBtn} aria-label="Закрыть">×</button>
      </div>

      <div style={s.nameRow}>
        <span style={s.name}>{water.name || "Водный объект"}</span>
      </div>

      <div style={s.statsBlock}>
        {segLengthKm !== null && (
          <div style={s.statRow}>
            <span style={s.statLabel}>Длина участка</span>
            <span style={s.statValue}>{segLengthKm.toFixed(1)} км</span>
          </div>
        )}
        {passport?.totalLengthKm && (
          <div style={s.statRow}>
            <span style={s.statLabel}>Общая длина</span>
            <span style={s.statValue}>{passport.totalLengthKm} км</span>
          </div>
        )}
      </div>

      {passport && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Паспорт</div>
          {passport.source && <PassportRow label="Исток" value={passport.source} />}
          {passport.mouth && <PassportRow label="Устье" value={passport.mouth} />}
          {passport.basin && <PassportRow label="Бассейн" value={passport.basin} />}
          {passport.tributaries && passport.tributaries.length > 0 && (
            <PassportRow label="Притоки" value={passport.tributaries.join(", ")} />
          )}
          {passport.notes && (
            <div style={s.notes}>{passport.notes}</div>
          )}
        </div>
      )}

      {posts.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Гидропосты ({posts.length})</div>
          {posts.map((p) => {
            const sc = p.status === "danger" ? "#ef4444" : p.status === "warning" ? "#f59e0b" : "#22c55e";
            return (
              <div key={p.code} style={s.postRow}>
                <span style={{ ...s.dot, background: sc }} />
                <span style={s.postLabel}>{p.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: sc, flexShrink: 0 }}>{p.waterLevel} см</span>
              </div>
            );
          })}
        </div>
      )}

      {!passport && posts.length === 0 && (
        <div style={s.noData}>Паспортные данные не найдены</div>
      )}
    </div>
  );
}

function PassportRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.passportRow}>
      <span style={s.passportLabel}>{label}</span>
      <span style={s.passportValue}>{value}</span>
    </div>
  );
}

const s = {
  panel: {
    height: "100%",
    background: "#161b22",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    display: "flex",
    flexDirection: "column" as const,
    overflowY: "auto" as const,
    color: "#c9d1d9",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px 0",
    flexShrink: 0,
  },
  kindBadge: {
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 5,
    padding: "2px 8px",
    letterSpacing: "0.04em",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#6e7681",
    fontSize: 22,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    flexShrink: 0,
  },
  nameRow: {
    padding: "8px 14px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    flexShrink: 0,
  },
  name: {
    fontSize: 16,
    fontWeight: 700,
    color: "#e6edf3",
    lineHeight: 1.3,
    wordBreak: "break-word" as const,
  },
  statsBlock: {
    padding: "8px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    flexShrink: 0,
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 0",
  },
  statLabel: { fontSize: 12, color: "#6e7681" },
  statValue: { fontSize: 12, fontWeight: 700, color: "#e6edf3" },
  section: {
    padding: "10px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#6e7681",
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    marginBottom: 8,
  },
  passportRow: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
    padding: "5px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  passportLabel: { fontSize: 10, color: "#484f58", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  passportValue: { fontSize: 12, color: "#c9d1d9", lineHeight: 1.4 },
  notes: { fontSize: 11, color: "#8b949e", marginTop: 6, lineHeight: 1.5, fontStyle: "italic" as const },
  postRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 0",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  dot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  postLabel: { flex: 1, fontSize: 12, color: "#c9d1d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  noData: { padding: "20px 14px", fontSize: 12, color: "#484f58", textAlign: "center" as const },
} as const;
