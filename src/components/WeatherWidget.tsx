"use client";

import { useEffect, useState } from "react";
import type { WeatherPoint } from "@/app/api/weather/route";
import type { Region } from "@/lib/types";

interface Props {
  region: Region;
  onWeatherSummary?: (summary: string) => void;
}

const REGION_TITLE: Record<Region, string> = {
  akmola: "Акмолинская область",
  kyzylorda: "Кызылординская область",
};

const ICON_SVG: Record<string, React.ReactNode> = {
  sun: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  "cloud-sun": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M12 2v2M4.22 4.22l1.42 1.42M2 12h2M19.78 4.22l-1.42 1.42"/>
      <path d="M17 12a5 5 0 0 0-9.58-1.44A3.5 3.5 0 1 0 6 17h11a4 4 0 1 0 0-8z"/>
    </svg>
  ),
  cloud: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/>
    </svg>
  ),
  rain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
      <line x1="8" y1="19" x2="8" y2="21"/><line x1="8" y1="13" x2="8" y2="15"/>
      <line x1="16" y1="19" x2="16" y2="21"/><line x1="16" y1="13" x2="16" y2="15"/>
      <line x1="12" y1="21" x2="12" y2="23"/><line x1="12" y1="15" x2="12" y2="17"/>
    </svg>
  ),
  drizzle: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
      <line x1="8" y1="19" x2="8" y2="21"/><line x1="16" y1="19" x2="16" y2="21"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
    </svg>
  ),
  showers: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
      <polyline points="8 19 8 22"/><polyline points="16 19 16 22"/>
      <polyline points="12 18 12 21"/>
    </svg>
  ),
  snow: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
      <line x1="8" y1="15" x2="8" y2="21"/><line x1="5" y1="18" x2="11" y2="18"/>
      <line x1="16" y1="15" x2="16" y2="21"/><line x1="13" y1="18" x2="19" y2="18"/>
    </svg>
  ),
  fog: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M5 5h14M5 9h14M5 13h14M5 17h14"/>
    </svg>
  ),
  storm: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/>
      <polyline points="13 11 9 17 15 17 11 23"/>
    </svg>
  ),
  snowshower: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/>
      <line x1="8" y1="16" x2="8" y2="20"/><line x1="16" y1="16" x2="16" y2="20"/>
    </svg>
  ),
};

const PRECIP_COLOR = {
  none:     { color: "#6e7681",  label: "Нет осадков" },
  low:      { color: "#60a5fa",  label: "Слабые осадки" },
  moderate: { color: "#f59e0b",  label: "Умеренные осадки" },
  high:     { color: "#ef4444",  label: "Сильные осадки" },
};

export function WeatherWidget({ region, onWeatherSummary }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<WeatherPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/weather?region=${region}`)
      .then((r) => r.json())
      .then((d: WeatherPoint[]) => {
        setData(d);
        setUpdatedAt(new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }));

        // Build text summary for AI
        if (onWeatherSummary) {
          const lines = d.map((w) => {
            const melt = w.snowMeltMm24h > 0 ? `, снеготаяние за 24ч: ~${w.snowMeltMm24h} мм` : "";
            return `${w.name}: ${w.temp}°C, ${w.condition}, осадки за 24ч: ${w.precip24h} мм${melt}, ветер ${w.windspeed} км/ч`;
          });
          onWeatherSummary(
            `[Погода в ${REGION_TITLE[region]} (данные Open-Meteo): ${lines.join("; ")}]`,
          );
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [region, onWeatherSummary]);

  const maxPrecip = data ? Math.max(...data.map((d) => d.precip24h), 0.1) : 1;
  const anyRain = data?.some((d) => d.precipLevel !== "none");

  return (
    <div style={s.wrap}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          ...s.toggleBtn,
          background: anyRain ? "rgba(239,68,68,0.15)" : "rgba(13,17,23,0.85)",
          borderColor: anyRain ? "#ef444440" : "rgba(255,255,255,0.1)",
          color: anyRain ? "#fca5a5" : "#8b949e",
        }}
        title={`Погода в ${REGION_TITLE[region]}`}
      >
        <span style={s.toggleIcon}>
          {ICON_SVG[loading ? "cloud" : (anyRain ? "rain" : "sun")]}
        </span>
        <span style={s.toggleLabel}>Погода</span>
        {anyRain && <span style={s.rainDot} />}
      </button>

      {/* Panel */}
      {open && data && (
        <div style={s.panel} className="detail-panel-in">
          <div style={s.panelHeader}>
            <span style={s.panelTitle}>{REGION_TITLE[region]}</span>
            <span style={s.panelTime}>обновлено {updatedAt}</span>
            <button onClick={() => setOpen(false)} style={s.closeBtn}>×</button>
          </div>

          <div style={s.cards}>
            {data.map((w) => {
              const pc = PRECIP_COLOR[w.precipLevel];
              const barPct = Math.min(100, (w.precip24h / maxPrecip) * 100);
              return (
                <div key={w.name} style={{
                  ...s.card,
                  borderColor: w.precipLevel !== "none" ? pc.color + "40" : "rgba(255,255,255,0.07)",
                }}>
                  <div style={s.cardTop}>
                    <span style={{ color: "#8b949e" }}>{ICON_SVG[w.icon]}</span>
                    <div style={s.cardInfo}>
                      <span style={s.cardName}>{w.name}</span>
                      <span style={s.cardCond}>{w.condition}</span>
                    </div>
                    <span style={{ ...s.cardTemp, color: w.temp > 0 ? "#f87171" : "#60a5fa" }}>
                      {w.temp > 0 ? "+" : ""}{w.temp}°
                    </span>
                  </div>

                  <div style={s.precipRow}>
                    <span style={{ ...s.precipLabel, color: pc.color }}>
                      {w.precip24h > 0 ? `${w.precip24h} мм за 24ч` : "Без осадков"}
                    </span>
                    <span style={s.windLabel}>{w.windspeed} км/ч</span>
                  </div>

                  {w.precip24h > 0 && (
                    <div style={s.barTrack}>
                      <div style={{ ...s.barFill, width: `${barPct}%`, background: pc.color }} />
                    </div>
                  )}

                  {w.snowMeltMm24h > 0 && (
                    <div style={s.precipRow}>
                      <span style={{ ...s.precipLabel, color: "#60a5fa" }}>
                        ❄️ снеготаяние ~{w.snowMeltMm24h} мм/24ч
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={s.footer}>
            Осадки влияют на уровень воды в реках через 12–48 ч
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    position: "absolute" as const,
    bottom: 36,
    left: 10,
    zIndex: 10,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    gap: 6,
  },
  toggleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 12px 6px 8px",
    border: "1px solid",
    borderRadius: 10,
    cursor: "pointer",
    backdropFilter: "blur(8px)",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    transition: "all 0.15s",
    position: "relative" as const,
  },
  toggleIcon: { display: "flex", alignItems: "center" },
  toggleLabel: {},
  rainDot: {
    position: "absolute" as const,
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#ef4444",
    boxShadow: "0 0 4px #ef4444",
  },
  panel: {
    width: 340,
    background: "rgba(13,17,23,0.93)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14,
    overflow: "hidden",
  },
  panelHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  panelTitle: { fontSize: 12, fontWeight: 700, color: "#e6edf3", flex: 1 },
  panelTime:  { fontSize: 10, color: "#484f58" },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#6e7681",
    fontSize: 18,
    cursor: "pointer",
    padding: 0,
    lineHeight: 1,
    fontFamily: "inherit",
  },
  cards: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
    padding: "8px 10px",
    maxHeight: 380,
    overflowY: "auto" as const,
  },
  card: {
    padding: "8px 10px",
    border: "1px solid",
    borderRadius: 9,
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
    marginBottom: 3,
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  cardInfo: { flex: 1, display: "flex", flexDirection: "column" as const, gap: 1 },
  cardName: { fontSize: 12, fontWeight: 600, color: "#e6edf3" },
  cardCond: { fontSize: 10, color: "#8b949e" },
  cardTemp: { fontSize: 18, fontWeight: 800, lineHeight: 1 },
  precipRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  precipLabel: { fontSize: 11, fontWeight: 600 },
  windLabel: { fontSize: 10, color: "#484f58" },
  barTrack: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 3,
    height: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  footer: {
    padding: "8px 14px",
    fontSize: 10,
    color: "#484f58",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    textAlign: "center" as const,
  },
} as const;
