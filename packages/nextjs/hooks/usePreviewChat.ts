"use client";

import { useState, useCallback } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SESSION_KEY = "ag_chat_count";
const MAX_MESSAGES = 10;

export function usePreviewChat(contentId: bigint, previewText: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    // Client-side rate limit
    const count = parseInt(sessionStorage.getItem(SESSION_KEY) || "0", 10);
    if (count >= MAX_MESSAGES) {
      setError("Message limit reached for this session.");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, String(count + 1));

    const userMsg: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsStreaming(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentId: contentId.toString(),
          previewText,
          messages: nextMessages,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      if (!res.body) throw new Error("No response body");

      // Stream SSE tokens
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            assistantText += delta;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant", content: assistantText };
              return updated;
            });
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setIsStreaming(false);
    }
  }, [messages, contentId, previewText]);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const remaining = MAX_MESSAGES - parseInt(
    typeof window !== "undefined" ? sessionStorage.getItem(SESSION_KEY) || "0" : "0", 10
  );

  return { messages, isStreaming, error, sendMessage, reset, remaining };
}
