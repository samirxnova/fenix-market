"use client";

import ReactMarkdown from "react-markdown";

export function ContentViewer({ markdown }: { markdown: string }) {
  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-secondary/20">
      <div className="flex items-center gap-2 px-6 py-3 bg-secondary/10 border-b border-secondary/20">
        <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <span className="label-caps text-secondary">Decrypted — visible only to you</span>
      </div>
      <div className="p-6 prose prose-invert prose-sm max-w-none
        prose-headings:font-manrope prose-headings:font-bold prose-headings:text-white
        prose-p:text-on-surface-variant prose-p:leading-relaxed
        prose-code:text-primary prose-code:bg-surface-container prose-code:px-1 prose-code:rounded
        prose-pre:bg-surface-container prose-pre:border prose-pre:border-outline-variant/30
        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white prose-li:text-on-surface-variant">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
