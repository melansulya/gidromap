import { NextRequest, NextResponse } from "next/server";

// Speech-to-text via OpenAI Whisper — separate from the DeepSeek chat model,
// which only handles text. Replaces the browser-only Web Speech API voice
// input (Chrome/Edge only) with a model that works in any browser.
export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Аудио не передано" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("file", audio, "voice.webm");
  upstream.append("model", "whisper-1");
  upstream.append("language", "ru");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: upstream,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[transcribe]", res.status, text);
    return NextResponse.json({ error: "Не удалось распознать речь" }, { status: 502 });
  }

  const data = (await res.json()) as { text: string };
  return NextResponse.json({ text: data.text ?? "" });
}
