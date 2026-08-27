import { NextRequest, NextResponse } from "next/server";

// Text-to-speech via OpenAI — the voice counterpart to /api/transcribe (Whisper),
// lets the assistant read its own answers back instead of just displaying text.
export async function POST(request: NextRequest) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Текст не передан" }, { status: 400 });
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      voice: "alloy",
      input: text.slice(0, 4000),
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("[speak]", res.status, errText);
    return NextResponse.json({ error: "Не удалось синтезировать речь" }, { status: 502 });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg" } });
}
