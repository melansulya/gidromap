"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (res.ok) router.replace("/");
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка входа");
        return;
      }
      if (data.needs2fa) {
        setTempToken(data.tempToken);
        return;
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify2fa(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tempToken, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка входа");
        return;
      }
      router.push("/");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <span style={s.badge}>AI Gidromap</span>
        <p style={s.subtitle}>Карта гидропостов Акмолинской области</p>

        {tempToken ? (
          <form onSubmit={handleVerify2fa} style={s.form}>
            <label style={s.label}>Код из приложения-аутентификатора</label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
              maxLength={6}
              autoFocus
              style={{ ...s.input, letterSpacing: "0.3em", textAlign: "center" as const, fontSize: 18 }}
            />

            {error && <p style={s.error}>{error}</p>}

            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? "Проверка..." : "Подтвердить"}
            </button>
            <button
              type="button"
              onClick={() => { setTempToken(null); setCode(""); setError(""); }}
              style={{ ...s.btn, background: "transparent", color: "#6e7681", marginTop: 8 }}
            >
              Назад
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <label style={s.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              style={s.input}
              autoComplete="email"
            />

            <label style={s.label}>Пароль</label>
            <div style={s.passwordWrap}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={s.passwordInput}
                autoComplete="current-password"
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

            {error && <p style={s.error}>{error}</p>}

            <button type="submit" disabled={loading} style={s.btn}>
              {loading ? "Вход..." : "Войти"}
            </button>
          </form>
        )}

        <p style={s.hint}>Доступ только для авторизованных пользователей</p>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0d1117",
    padding: 16,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    background: "#161b22",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "32px 28px 24px",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
  },
  badge: {
    background: "#22c55e18",
    color: "#22c55e",
    border: "1px solid #22c55e40",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#6e7681",
    marginBottom: 24,
    textAlign: "center" as const,
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: 5,
  },
  label: {
    fontSize: 12,
    color: "#8b949e",
    marginTop: 8,
    marginBottom: 2,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    background: "#0d1117",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e6edf3",
    fontSize: 14,
    padding: "9px 12px",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  passwordWrap: {
    position: "relative" as const,
    width: "100%",
  },
  passwordInput: {
    width: "100%",
    background: "#0d1117",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e6edf3",
    fontSize: 14,
    padding: "9px 40px 9px 12px",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  eyeBtn: {
    position: "absolute" as const,
    right: 10,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#6e7681",
    cursor: "pointer",
    padding: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    padding: "6px 10px",
    background: "#ef444410",
    border: "1px solid #ef444430",
    borderRadius: 6,
  },
  btn: {
    marginTop: 14,
    width: "100%",
    background: "#1f6feb",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 0",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  hint: {
    marginTop: 18,
    fontSize: 11,
    color: "#484f58",
    textAlign: "center" as const,
  },
} as const;
