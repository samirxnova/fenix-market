import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { messages, previewText } = await req.json();

  if (!process.env.OPENROUTER_API_KEY) {
    return new Response("OPENROUTER_API_KEY not configured", { status: 500 });
  }

  const systemPrompt = `You are an assistant for a content listing on Encora, a privacy-preserving content marketplace.
You have access ONLY to the following public preview of the content:

---
${previewText}
---

Answer questions based solely on this preview. Be helpful and specific about what the preview covers.
If asked about details not in the preview, say the full content covers that in depth and suggest purchasing to access it.
Do not fabricate information beyond what the preview contains. Keep answers concise.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://encora.xyz",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return new Response(`OpenRouter error: ${err}`, { status: res.status });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
