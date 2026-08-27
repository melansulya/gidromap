"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Props = {
  email: string;
  enabled: boolean;
  onClose: () => void;
  onChanged: (enabled: boolean) => void;
};

export function TwoFactorModal({ email, enabled, onClose, onChanged }: Props) {
  const [secret, setSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (enabled) return;
    fetch("/api/auth/2fa/setup", { method: "POST" }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json() as { secret: string; otpauthUrl: string };
      setSecret(data.secret);
      const url = await QRCode.toDataURL(data.otpauthUrl, { margin: 1, width: 220 });
      setQrDataUrl(url);
    });
  }, [enabled]);

  async function handleConfirm() {
    if (!secret) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Не удалось включить 2FA"); return; }
      setDone(true);
      onChanged(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/2fa/disable", { method: "POST" });
      if (!res.ok) { setError("Не удалось отключить 2FA"); return; }
      onChanged(false);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>Двухфакторная аутентификация</span>
          <button onClick={onClose} style={s.closeBtn}>×</button>
        </div>

        {enabled ? (
          <>
            <p style={s.text}>2FA включена для {email}. При входе после пароля будет запрашиваться код из приложения-аутентификатора.</p>
            {error && <p style={s.error}>{error}</p>}
            <button onClick={handleDisable} disabled={busy} style={s.dangerBtn}>
              {busy ? "..." : "Отключить 2FA"}
            </button>
          </>
        ) : done ? (
          <p style={s.text}>Готово — 2FA включена. При следующем входе потребуется код из приложения.</p>
        ) : (
          <>
            <p style={s.text}>1. Отсканируйте QR-код приложением-аутентификатором (Google Authenticator, Authy и т.п.)</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR-код для 2FA" style={s.qr} />
            ) : (
              <div style={{ ...s.qr, display: "flex", alignItems: "center", justifyContent: "center", color: "#6e7681" }}>Загрузка…</div>
            )}
            {secret && (
              <p style={s.secretHint}>Или введите вручную: <code style={s.code}>{secret}</code></p>
            )}
            <p style={s.text}>2. Введите код из приложения, чтобы подтвердить:</p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
              style={s.input}
            />
            {error && <p style={s.error}>{error}</p>}
            <button onClick={handleConfirm} disabled={busy || code.trim().length !== 6} style={s.confirmBtn}>
              {busy ? "Проверка…" : "Включить 2FA"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  card: {
    width: 320, background: "#161b22", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column" as const, gap: 10,
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title: { fontSize: 14, fontWeight: 700, color: "#e6edf3" },
  closeBtn: { background: "none", border: "none", color: "#6e7681", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 },
  text: { fontSize: 12.5, color: "#8b949e", margin: 0, lineHeight: 1.5 },
  qr: { width: 220, height: 220, alignSelf: "center", borderRadius: 8, background: "#fff" },
  secretHint: { fontSize: 11, color: "#6e7681", margin: 0, textAlign: "center" as const },
  code: { background: "#0d1117", padding: "2px 6px", borderRadius: 4, fontSize: 11, color: "#e6edf3" },
  input: {
    background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
    color: "#e6edf3", fontSize: 18, padding: "9px 12px", outline: "none", fontFamily: "inherit",
    textAlign: "center" as const, letterSpacing: "0.3em",
  },
  confirmBtn: {
    background: "#1f6feb", border: "none", borderRadius: 8, color: "#fff", fontSize: 13,
    fontWeight: 600, padding: "9px 0", cursor: "pointer", fontFamily: "inherit",
  },
  dangerBtn: {
    background: "#ef444418", border: "1px solid #ef444440", borderRadius: 8, color: "#ef4444",
    fontSize: 13, fontWeight: 600, padding: "9px 0", cursor: "pointer", fontFamily: "inherit",
  },
  error: {
    fontSize: 12, color: "#ef4444", margin: 0, padding: "6px 10px",
    background: "#ef444410", border: "1px solid #ef444430", borderRadius: 6,
  },
} as const;
