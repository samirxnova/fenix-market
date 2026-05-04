"use client";

import { useState, useRef, useEffect } from "react";
import { usePreviewChat } from "@/hooks/usePreviewChat";

export function PreviewChat({ contentId, previewText }: { contentId: bigint; previewText: string }) {
  const { messages, isStreaming, error, sendMessage, remaining } = usePreviewChat(contentId, previewText);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    const text = input.trim();
    setInput("");
    await sendMessage(text);
  }

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-white/5 px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <svg className="w-3 h-3 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
              <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
            </svg>
          </div>
          <span className="font-manrope font-bold text-white text-sm">Ask about this content</span>
        </div>
        <span className="label-caps text-slate-500">{remaining} msgs left</span>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-5 space-y-4 bg-surface-container-lowest/50">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-xs text-slate-500">AI answers based on the public preview only.</p>
            <p className="text-xs text-slate-600">Purchase to unlock the full content.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
              m.role === "user"
                ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-tr-none"
                : "bg-surface-container-highest text-on-surface rounded-tl-none"
            }`}>
              {m.content || <span className="animate-pulse text-slate-400">▋</span>}
            </div>
          </div>
        ))}
        {error && <p className="text-xs text-error text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 p-3 bg-surface-container-low border-t border-white/5">
        <div className="flex-1 flex items-center gap-2 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-3 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isStreaming || remaining <= 0}
            placeholder={remaining <= 0 ? "Message limit reached" : "Type your question…"}
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim() || remaining <= 0}
            className="text-indigo-400 hover:text-primary disabled:opacity-30 transition-colors p-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
