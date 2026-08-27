"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage, Clarification, ChatResponse, MapState, Region } from "@/lib/types";
import type { MeasureResult, WaterTraceResult } from "@/lib/measure";
import { track } from "@/lib/track";
import { TwoFactorModal } from "@/components/TwoFactorModal";

// ── Types ──────────────────────────────────────────────────────────────────────

type AuthUser = { email: string; name: string; role: "admin" | "akim" | "deputy"; totpEnabled?: boolean };

type LocalChat = {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
};

// ── localStorage helpers ──────────────────────────────────────────────────────

function chatsKey(email: string) { return `agm_chats_${email}`; }

function loadChats(email: string): LocalChat[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(chatsKey(email)) ?? "[]"); }
  catch { return []; }
}

function saveChats(email: string, chats: LocalChat[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(chatsKey(email), JSON.stringify(chats));
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} style={{ color: "#e6edf3", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
      : part
  );
}

function parseTableRow(line: string): string[] {
  return line.split("|").slice(1, -1).map((c) => c.trim());
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^[-•]\s*/gm, "")
    .replace(/\|/g, " ")
    .trim();
}

function isTableSep(line: string): boolean {
  return /^\|[-| :]+\|$/.test(line.trim());
}

function MarkdownBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let k = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (line.trimStart().startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const headers = parseTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        rows.push(parseTableRow(lines[i++]));
      }
      nodes.push(
        <div key={k++} style={{ overflowX: "auto", marginBottom: 6 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead><tr>
              {headers.map((h, hi) => (
                <th key={hi} style={{ padding: "5px 8px", textAlign: "left", color: "#8b949e", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.12)", whiteSpace: "nowrap" }}>{renderInline(h)}</th>
              ))}
            </tr></thead>
            <tbody>{rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)" }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: "4px 8px", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#c9d1d9", lineHeight: 1.5 }}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}</tbody>
          </table>
        </div>
      );
      continue;
    }

    i++;
    if (line.trim() === "") { nodes.push(<div key={k++} style={{ height: 5 }} />); continue; }
    if (/^---+$/.test(line.trim())) { nodes.push(<hr key={k++} style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "6px 0" }} />); continue; }
    if (line.startsWith("### ")) { nodes.push(<div key={k++} style={{ fontWeight: 700, color: "#e6edf3", fontSize: 13, marginTop: 6, marginBottom: 2 }}>{renderInline(line.slice(4))}</div>); continue; }
    if (/^\*\*[^*]+\*\*$/.test(line.trim())) { nodes.push(<div key={k++} style={{ fontWeight: 700, color: "#e6edf3", marginTop: 4, marginBottom: 1 }}>{line.trim().slice(2, -2)}</div>); continue; }

    const bulletMatch = line.match(/^(\s*)([-•*])\s+(.+)/);
    if (bulletMatch) {
      nodes.push(
        <div key={k++} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 2, paddingLeft: bulletMatch[1].length > 0 ? 16 : 0 }}>
          <span style={{ color: "#22c55e", flexShrink: 0, marginTop: 1, lineHeight: 1.5 }}>•</span>
          <span style={{ lineHeight: 1.55 }}>{renderInline(bulletMatch[3])}</span>
        </div>
      );
      continue;
    }
    const numMatch = line.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      nodes.push(
        <div key={k++} style={{ display: "flex", gap: 7, alignItems: "flex-start", marginBottom: 2 }}>
          <span style={{ color: "#60a5fa", flexShrink: 0, minWidth: 18, lineHeight: 1.55 }}>{numMatch[1]}.</span>
          <span style={{ lineHeight: 1.55 }}>{renderInline(numMatch[2])}</span>
        </div>
      );
      continue;
    }
    nodes.push(<div key={k++} style={{ lineHeight: 1.6, marginBottom: 1 }}>{renderInline(line)}</div>);
  }
  return <>{nodes}</>;
}

// ── Props ──────────────────────────────────────────────────────────────────────

type Props = {
  region: Region;
  activePostCode: number | null;
  highlightedPostCodes: number[];
  isMeasureMode: boolean;
  measureResult: MeasureResult | null;
  isWaterTraceMode: boolean;
  waterTraceResult: WaterTraceResult | null;
  weatherContext: string;
  onMapUpdate: (patch: Partial<MapState>) => void;
  onMeasureModeChange: (active: boolean) => void;
  onWaterTraceModeChange: (active: boolean) => void;
};

const QUICK_PROMPTS: Record<Region, string[]> = {
  akmola: [
    "Покажи гидропосты на Нуре",
    "Какие посты в красной зоне?",
    "Гидропосты на Есиле",
    "Сколько постов в warning?",
  ],
  kyzylorda: [
    "Покажи гидропосты на Сырдарье",
    "Гидропосты в Аральском районе",
    "Сколько постов в Кармакшинском районе?",
    "Что за пост Тасбугет?",
  ],
};

let msgCounter = 0;
function uid() { return String(++msgCounter); }

// ── Component ─────────────────────────────────────────────────────────────────

function downloadMd(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function mdToHtml(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/^[-•*] (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)[.)]\s+(.+)$/gm, "<li>$2</li>")
    .replace(/^---+$/gm, "<hr>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[hHlp])(.+)$/gm, "<p>$1</p>");
}

function downloadDoc(text: string, filename: string) {
  const date = new Date().toLocaleDateString("ru-RU");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;line-height:1.7;font-size:14px;color:#111}
h1,h2,h3{color:#1a3c5e}li{margin-bottom:4px}hr{border:1px solid #ddd;margin:16px 0}
.meta{color:#888;font-size:12px;margin-bottom:24px}</style></head>
<body><h1>AI Gidromap</h1><p class="meta">${date}</p><hr>${mdToHtml(text)}</body></html>`;
  const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function ChatPanel({ region, activePostCode, highlightedPostCodes, isMeasureMode, measureResult, isWaterTraceMode, waterTraceResult, weatherContext, onMapUpdate, onMeasureModeChange, onWaterTraceModeChange }: Props) {
  const router = useRouter();

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [show2fa, setShow2fa] = useState(false);

  const [chats, setChats] = useState<LocalChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [showChatList, setShowChatList] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── Auth check on mount ───────────────────────────────────────────────────

  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (!res.ok) { router.push("/login"); return; }
      const user: AuthUser = await res.json();
      setAuthUser(user);
      const stored = loadChats(user.email);
      setChats(stored);
      if (stored.length > 0) setShowChatList(true);
      setAuthLoaded(true);
    });
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Chat management ───────────────────────────────────────────────────────

  function persistChats(email: string, updated: LocalChat[]) {
    setChats(updated);
    saveChats(email, updated);
  }

  function newChat() {
    setActiveChatId(null);
    setMessages([]);
    setClarification(null);
    setShowChatList(false);
  }

  // Switching region starts a fresh chat — old messages/tool results may reference
  // hydroposts, districts or rivers that don't exist in the newly selected region.
  const didMountRegionRef = useRef(false);
  useEffect(() => {
    if (!didMountRegionRef.current) { didMountRegionRef.current = true; return; }
    newChat();
  }, [region]);

  function selectChat(chat: LocalChat) {
    setActiveChatId(chat.id);
    setMessages(chat.messages);
    setClarification(null);
    setShowChatList(false);
  }

  function deleteChat(chatId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!authUser) return;
    const updated = chats.filter((c) => c.id !== chatId);
    persistChats(authUser.email, updated);
    if (activeChatId === chatId) { setActiveChatId(null); setMessages([]); setShowChatList(true); }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function send(text: string) {
    const query = text.trim();
    if (!query || loading || !authUser) return;

    setInput("");
    setShowChatList(false);

    const userMsg: ChatMessage = { id: uid(), role: "user", text: query };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setLoading(true);

    // Ensure active chat exists
    let chatId = activeChatId;
    if (!chatId) {
      chatId = crypto.randomUUID();
      setActiveChatId(chatId);
    }

    try {
      const contextParts: string[] = [];
      if (highlightedPostCodes.length > 0 || activePostCode !== null) {
        const codes = highlightedPostCodes.length > 0 ? highlightedPostCodes : [activePostCode!];
        contextParts.push(`[Контекст карты: сейчас на карте выделены гидропосты с кодами ${codes.join(", ")}.]`);
      }
      if (weatherContext) contextParts.push(weatherContext);
      const mapContext = contextParts.length > 0 ? contextParts.join("\n") : undefined;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sessionId: chatId, mapContext, region }),
      });

      const data: ChatResponse = await res.json();
      const aiMsg: ChatMessage = { id: uid(), role: "ai", text: data.answer };
      const finalMessages = [...nextMessages, aiMsg];
      setMessages(finalMessages);
      if (data.mapUpdate) onMapUpdate(data.mapUpdate);
      setClarification(data.clarification ?? null);

      // Persist to localStorage
      const isFirst = messages.length === 0;
      const title = isFirst
        ? (query.length > 48 ? query.slice(0, 45) + "..." : query)
        : (chats.find((c) => c.id === chatId)?.title ?? query.slice(0, 40));

      const updatedChat: LocalChat = { id: chatId, title, updatedAt: new Date().toISOString(), messages: finalMessages };
      const others = chats.filter((c) => c.id !== chatId);
      persistChats(authUser.email, [updatedChat, ...others]);
    } catch {
      const errMsg: ChatMessage = { id: uid(), role: "ai", text: "Не удалось получить ответ. Проверь подключение." };
      const finalMessages = [...nextMessages, errMsg];
      setMessages(finalMessages);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  async function handleVoice() {
    if (listening) { mediaRecorderRef.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("Голосовой ввод не поддерживается в этом браузере");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);

      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        setTranscribing(true);
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const data = await res.json() as { text?: string; error?: string };
          if (data.text?.trim()) send(data.text.trim());
          else alert("Не удалось распознать речь");
        } catch {
          alert("Не удалось распознать речь");
        } finally {
          setTranscribing(false);
        }
      };

      rec.start();
      mediaRecorderRef.current = rec;
      setListening(true);
    } catch {
      alert("Нет доступа к микрофону");
    }
  }

  async function handleSpeak(msg: ChatMessage) {
    if (speakingId === msg.id) {
      audioRef.current?.pause();
      setSpeakingId(null);
      return;
    }
    audioRef.current?.pause();
    setSpeakingId(msg.id);
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: stripMarkdown(msg.text) }),
      });
      if (!res.ok) throw new Error("speak failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setSpeakingId(null);
      audio.onerror = () => setSpeakingId(null);
      await audio.play();
    } catch {
      setSpeakingId(null);
      alert("Не удалось озвучить ответ");
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (!authLoaded) {
    return (
      <div style={s.panel}>
        <div style={s.header}><span style={s.badge}>AI Gidromap</span></div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#484f58", fontSize: 13 }}>Загрузка...</span>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const displayName = authUser?.name || authUser?.email?.split("@")[0] || "?";

  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <span style={s.badge}>AI Gidromap</span>
        <div style={s.headerRight}>
          <a href="/dashboard" style={s.adminBtn} title="Дашборд — сводка по региону">📊</a>
          {authUser?.role === "admin" && (
            <a href="/admin" style={s.adminBtn} title="Управление пользователями">⚙</a>
          )}
          <div style={s.userChip} title={`${authUser?.email} · ${authUser?.role}`}>
            <span style={s.userAvatar}>{displayName[0]?.toUpperCase()}</span>
            <span style={s.userName}>{displayName}</span>
          </div>
          {messages.length > 0 && (
            <>
              <button
                onClick={() => {
                  const date = new Date().toLocaleDateString("ru-RU");
                  const lines = [`# AI Gidromap — Диалог`, `_${date}_`, "", "---", ""];
                  for (const msg of messages) {
                    if (msg.role === "user") lines.push(`**Вы:** ${msg.text}`, "");
                    else lines.push(`**AI Gidromap:**`, msg.text, "", "---", "");
                  }
                  downloadMd(lines.join("\n"), `gidromap-chat-${Date.now()}.md`);
                  track("export_doc", { format: "md", scope: "chat", messages: messages.length });
                }}
                style={s.iconBtn}
                title="Скачать диалог (.md)"
              >.md</button>
              <button
                onClick={() => {
                  const parts = messages.map((m) =>
                    m.role === "user" ? `<p><b>Вы:</b> ${m.text}</p>` : `<div>${mdToHtml(m.text)}</div><hr>`
                  ).join("\n");
                  downloadDoc(parts, `gidromap-chat-${Date.now()}.doc`);
                  track("export_doc", { format: "doc", scope: "chat", messages: messages.length });
                }}
                style={s.iconBtn}
                title="Скачать диалог (.doc)"
              >.doc</button>
            </>
          )}
          <button onClick={newChat} style={s.iconBtn} title="Новый чат">＋</button>
          <button
            onClick={() => setShowChatList((v) => !v)}
            style={{ ...s.iconBtn, color: showChatList ? "#60a5fa" : "#6e7681" }}
            title="История чатов"
          >≡</button>
          <button
            onClick={() => setShow2fa(true)}
            style={{ ...s.iconBtn, color: authUser?.totpEnabled ? "#22c55e" : "#6e7681" }}
            title={authUser?.totpEnabled ? "2FA включена" : "Настроить 2FA"}
          >🔒</button>
          <button onClick={handleLogout} style={s.iconBtn} title="Выйти">↩</button>
        </div>
      </div>

      {show2fa && authUser && (
        <TwoFactorModal
          email={authUser.email}
          enabled={authUser.totpEnabled ?? false}
          onClose={() => setShow2fa(false)}
          onChanged={(enabled) => setAuthUser((u) => (u ? { ...u, totpEnabled: enabled } : u))}
        />
      )}

      {/* Chat list */}
      {showChatList ? (
        <div style={s.chatListArea}>
          <div style={s.chatListTitle}>Мои чаты</div>
          {chats.length === 0 && <div style={s.chatListEmpty}>Нет чатов. Начни новый →</div>}
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => selectChat(chat)}
              style={{
                ...s.chatItem,
                background: chat.id === activeChatId ? "rgba(31,111,235,0.12)" : "transparent",
                borderColor: chat.id === activeChatId ? "rgba(31,111,235,0.3)" : "rgba(255,255,255,0.05)",
              }}
            >
              <span style={s.chatIcon}>💬</span>
              <span style={s.chatTitle}>{chat.title}</span>
              <span style={s.chatAge}>{relativeTime(chat.updatedAt)}</span>
              <span onClick={(e) => deleteChat(chat.id, e)} style={s.chatDelete} title="Удалить">✕</span>
            </button>
          ))}
          <button onClick={newChat} style={s.newChatBtn}>＋ Новый чат</button>
        </div>
      ) : (
        /* Messages view */
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={s.empty}>
              <p style={s.emptyTitle}>Спроси что-нибудь о карте</p>
              <p style={s.emptyHint}>или задай любой вопрос — я отвечу</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} style={msg.role === "user" ? s.userBubble : s.aiBubble}>
              {msg.role === "ai" ? (
                <>
                  <MarkdownBlock text={msg.text} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 4 }}>
                    <button
                      onClick={() => handleSpeak(msg)}
                      style={s.downloadBtn}
                      title={speakingId === msg.id ? "Остановить" : "Озвучить"}
                    >{speakingId === msg.id ? "⏸" : "🔊"}</button>
                    <button
                      onClick={() => {
                        const date = new Date().toLocaleDateString("ru-RU");
                        downloadMd(`# AI Gidromap — Ответ ИИ\n_${date}_\n\n---\n\n${msg.text}`, `gidromap-${Date.now()}.md`);
                        track("export_doc", { format: "md", scope: "message" });
                      }}
                      style={s.downloadBtn}
                      title="Скачать .md"
                    >.md</button>
                    <button
                      onClick={() => {
                        downloadDoc(msg.text, `gidromap-${Date.now()}.doc`);
                        track("export_doc", { format: "doc", scope: "message" });
                      }}
                      style={s.downloadBtn}
                      title="Скачать .doc (Word)"
                    >.doc</button>
                  </div>
                </>
              ) : msg.text}
            </div>
          ))}
          {loading && <div style={s.aiBubble}><span style={s.dots}>· · ·</span></div>}
          {clarification && !loading && (
            <div style={s.clarificationCard}>
              <p style={s.clarificationQ}>{clarification.question}</p>
              <div style={s.clarificationBtns}>
                <button style={s.clarBtnYes} onClick={() => { setClarification(null); send(`${clarification.queryBase}. Считать только основные реки: да.`); }}>Да, только основные</button>
                <button style={s.clarBtnNo} onClick={() => { setClarification(null); send(`${clarification.queryBase}. Считать только основные реки: нет.`); }}>Нет, все реки</button>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Quick prompts */}
      {!showChatList && messages.length === 0 && (
        <div style={s.quickList}>
          {QUICK_PROMPTS[region].map((p) => (
            <button key={p} style={s.quickBtn} onClick={() => send(p)}>{p}</button>
          ))}
        </div>
      )}

      {/* Measure result */}
      {measureResult && (
        <div style={measureResult.status === "success" ? s.measureSuccess : s.measureError}>
          {measureResult.status === "success" ? (
            <><span style={s.measureLabel}>📏 {measureResult.objectName}</span><strong style={s.measureDist}>{measureResult.distanceKm.toFixed(2)} км</strong></>
          ) : <span>{measureResult.message}</span>}
        </div>
      )}

      {/* Water trace result */}
      {waterTraceResult && (
        waterTraceResult.connected ? (
          <div style={s.measureSuccess}>
            <span style={s.measureLabel}>🌊 {waterTraceResult.labelA} → {waterTraceResult.labelB}</span>
            <strong style={s.measureDist}>{waterTraceResult.distanceKm.toFixed(2)} км</strong>
          </div>
        ) : (
          <div style={s.traceNoConn}>
            <span>🚫</span>
            <span>{waterTraceResult.labelA} и {waterTraceResult.labelB} не связаны водным путём</span>
          </div>
        )
      )}

      {/* Map tools toolbar */}
      <div style={s.toolBar}>
        <button
          type="button"
          onClick={() => onMeasureModeChange(!isMeasureMode)}
          style={{ ...s.toolBtn, ...(isMeasureMode ? s.toolBtnActive : {}) }}
        >
          <span style={s.toolIcon}>📏</span>
          <span style={s.toolLabel}>Расстояние</span>
        </button>
        <button
          type="button"
          onClick={() => onWaterTraceModeChange(!isWaterTraceMode)}
          style={{ ...s.toolBtn, ...(isWaterTraceMode ? s.toolBtnActiveBlue : {}) }}
        >
          <span style={s.toolIcon}>🌊</span>
          <span style={s.toolLabel}>Водный след</span>
        </button>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={s.form}>
        <button type="button" onClick={handleVoice} disabled={transcribing} title={transcribing ? "Распознаётся…" : "Голосовой ввод"} style={{ ...s.rulerBtn, background: listening ? "#ef444418" : "transparent", color: listening ? "#ef4444" : "#6e7681", borderColor: listening ? "#ef444440" : "rgba(255,255,255,0.08)", animation: listening ? "pulse 1s infinite" : "none", opacity: transcribing ? 0.6 : 1 }}>{transcribing ? "…" : "🎙"}</button>
        <textarea style={s.textarea} value={input} onChange={(e) => setInput(e.target.value)} placeholder={isMeasureMode ? "Кликай по рекам на карте…" : isWaterTraceMode ? "Кликай точки на карте…" : "Любой вопрос…"} rows={2} disabled={isMeasureMode || isWaterTraceMode} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} />
        <button type="submit" disabled={loading || !input.trim() || isMeasureMode || isWaterTraceMode} style={s.sendBtn}>{loading ? "…" : "→"}</button>
      </form>
    </div>
  );
}

function statusColor(s: string) {
  if (s === "danger") return "#ef4444";
  if (s === "warning") return "#f59e0b";
  return "#22c55e";
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "только что";
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ч`;
  return `${Math.floor(h / 24)}д`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = {
  panel: { width: 360, minWidth: 320, display: "flex", flexDirection: "column" as const, background: "#161b22", borderLeft: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" },
  header: { padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 },
  badge: { background: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e40", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, flexShrink: 0 },
  headerRight: { display: "flex", alignItems: "center", gap: 4 },
  adminBtn: { fontSize: 14, color: "#8b949e", padding: "3px 6px", borderRadius: 6, textDecoration: "none", cursor: "pointer" },
  userChip: { display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: "2px 8px 2px 4px" },
  userAvatar: { width: 20, height: 20, borderRadius: "50%", background: "#1f6feb", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  userName: { fontSize: 11, color: "#8b949e", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  iconBtn: { width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", borderRadius: 6, color: "#6e7681", fontSize: 14, cursor: "pointer", padding: 0 },
  postCard: { margin: "10px 12px", padding: "12px 14px", background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, flexShrink: 0 },
  postCardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  postName: { fontSize: 14, color: "#e6edf3", fontWeight: 600 },
  postMeta: { fontSize: 12, color: "#6e7681", display: "flex", gap: 4, marginBottom: 4 },
  postBreadcrumb: { fontSize: 11, color: "#484f58", display: "flex", alignItems: "center", gap: 4, marginBottom: 8, flexWrap: "wrap" as const },
  breadcrumbSep: { color: "#30363d", fontSize: 10 },
  postLevel: { display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 },
  postLevelLabel: { fontSize: 11, color: "#6e7681", textTransform: "uppercase" as const, letterSpacing: "0.08em" },
  historyBar: { borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 },
  historyLabel: { fontSize: 11, color: "#6e7681", display: "block", marginBottom: 6 },
  miniChart: { display: "flex", alignItems: "flex-end", gap: 3, height: 36 },
  miniBar: { flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" },
  miniBarFill: { width: "100%", borderRadius: "2px 2px 0 0", minHeight: 2 },
  miniBarYear: { fontSize: 9, color: "#484f58" },
  chatListArea: { flex: 1, overflowY: "auto" as const, padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 4 },
  chatListTitle: { fontSize: 11, fontWeight: 600, color: "#484f58", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 6, padding: "0 2px" },
  chatListEmpty: { fontSize: 13, color: "#484f58", padding: "8px 2px" },
  chatItem: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", border: "1px solid", borderRadius: 8, cursor: "pointer", textAlign: "left" as const, width: "100%", fontFamily: "inherit" },
  chatIcon: { fontSize: 13, flexShrink: 0, opacity: 0.5 },
  chatTitle: { flex: 1, fontSize: 13, color: "#c9d1d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  chatAge: { fontSize: 10, color: "#484f58", flexShrink: 0 },
  chatDelete: { fontSize: 11, color: "#484f58", flexShrink: 0, cursor: "pointer", padding: "2px 4px", borderRadius: 4 },
  newChatBtn: { marginTop: 4, padding: "8px 12px", background: "rgba(31,111,235,0.1)", border: "1px solid rgba(31,111,235,0.25)", borderRadius: 8, color: "#60a5fa", fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const },
  messages: { flex: 1, overflowY: "auto" as const, padding: "10px 12px", display: "flex", flexDirection: "column" as const, gap: 8 },
  empty: { margin: "auto", textAlign: "center" as const, paddingTop: 40 },
  emptyTitle: { fontSize: 14, color: "#8b949e", marginBottom: 4 },
  emptyHint: { fontSize: 12, color: "#484f58" },
  userBubble: { alignSelf: "flex-end" as const, background: "#1f6feb", color: "#fff", borderRadius: "12px 12px 3px 12px", padding: "8px 12px", fontSize: 13, maxWidth: "85%", lineHeight: 1.5, wordBreak: "break-word" as const },
  aiBubble: { alignSelf: "flex-start" as const, background: "#21262d", color: "#c9d1d9", borderRadius: "12px 12px 12px 3px", padding: "8px 12px", fontSize: 13, maxWidth: "92%", lineHeight: 1.6, wordBreak: "break-word" as const, border: "1px solid rgba(255,255,255,0.06)" },
  dots: { display: "inline-flex", gap: 4, alignItems: "center" },
  clarificationCard: { alignSelf: "flex-start" as const, background: "#21262d", border: "1px solid #f59e0b40", borderRadius: 10, padding: "10px 12px", maxWidth: "92%" },
  clarificationQ: { fontSize: 13, color: "#f59e0b", marginBottom: 8, fontWeight: 500 },
  clarificationBtns: { display: "flex", gap: 6 },
  clarBtnYes: { flex: 1, background: "#22c55e18", border: "1px solid #22c55e40", borderRadius: 6, color: "#22c55e", fontSize: 12, padding: "5px 8px", cursor: "pointer", fontFamily: "inherit" },
  clarBtnNo: { flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#8b949e", fontSize: 12, padding: "5px 8px", cursor: "pointer", fontFamily: "inherit" },
  quickList: { padding: "0 12px 8px", display: "flex", flexDirection: "column" as const, gap: 5, flexShrink: 0 },
  quickBtn: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#8b949e", fontSize: 12, padding: "6px 10px", cursor: "pointer", textAlign: "left" as const, transition: "all 0.15s", fontFamily: "inherit" },
  downloadBtn: { background: "none", border: "none", cursor: "pointer", color: "#484f58", fontSize: 11, padding: "2px 6px", borderRadius: 4, lineHeight: 1 },
  measureSuccess: { margin: "0 12px 8px", padding: "8px 12px", background: "#22d3ee10", border: "1px solid #22d3ee30", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  measureError: { margin: "0 12px 8px", padding: "8px 12px", background: "#ef444410", border: "1px solid #ef444430", borderRadius: 8, fontSize: 12, color: "#ef4444", flexShrink: 0 },
  traceNoConn: { margin: "0 12px 8px", padding: "8px 12px", background: "#f9731610", border: "1px solid #f9731630", borderRadius: 8, fontSize: 12, color: "#f97316", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 },
  measureLabel: { fontSize: 12, color: "#8b949e" },
  measureDist: { fontSize: 16, color: "#22d3ee" },
  toolBar: { padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexShrink: 0 },
  toolBtn: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" },
  toolBtnActive: { background: "#22d3ee15", border: "1px solid #22d3ee40", boxShadow: "0 0 8px #22d3ee18" },
  toolBtnActiveBlue: { background: "#3b82f615", border: "1px solid #3b82f640", boxShadow: "0 0 8px #3b82f618" },
  toolIcon: { fontSize: 15 },
  toolLabel: { fontSize: 12, color: "#8b949e", fontWeight: 500 },
  rulerBtn: { width: 36, height: 36, alignSelf: "flex-end" as const, border: "1px solid", borderRadius: 8, fontSize: 16, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" },
  form: { padding: "6px 12px 12px", borderTop: "none", display: "flex", gap: 8, flexShrink: 0 },
  textarea: { flex: 1, resize: "none" as const, background: "#0d1117", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#e6edf3", fontSize: 13, padding: "8px 10px", lineHeight: 1.5, outline: "none", fontFamily: "inherit" },
  sendBtn: { width: 36, height: 36, alignSelf: "flex-end" as const, background: "#1f6feb", border: "none", borderRadius: 8, color: "#fff", fontSize: 18, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
} as const;
