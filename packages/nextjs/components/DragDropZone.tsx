"use client";

import { useState, useRef } from "react";

export function DragDropZone({ onContent }: { onContent: (text: string, fileName: string) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.name.endsWith(".md") || file.name.endsWith(".txt") || file.type === "text/plain" || file.type === "text/markdown") {
      const text = await file.text();
      onContent(text, file.name);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-outline-variant/30 hover:border-outline-variant/60"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".md,.txt,text/plain,text/markdown"
        onChange={handleChange}
        className="hidden"
      />
      <div className="space-y-2">
        <svg className="w-8 h-8 mx-auto text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm text-on-surface-variant">
          {isDragging ? "Drop file here" : "Drag & drop a .md or .txt file, or click to browse"}
        </p>
      </div>
    </div>
  );
}
