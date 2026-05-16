"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEncora } from "@/hooks/useEncora";
import { useCofheConnected } from "@/hooks/useCofhe";
import { DragDropZone } from "@/components/DragDropZone";
import toast from "react-hot-toast";

const CATEGORIES = ["diet", "fitness", "skills", "finance", "code", "health", "other"];

const STEPS = ["Metadata", "Content", "Encrypt & Deploy"];

const ENCRYPT_STEPS = [
  { label: "Generating AES-256 key", icon: "🔑" },
  { label: "Encrypting content", icon: "🔒" },
  { label: "FHE-encrypting key chunks", icon: "⛓" },
  { label: "Submitting to chain", icon: "📡" },
];

export default function UploadPage() {
  const router = useRouter();
  const { uploadContent } = useEncora();
  const isConnected = useCofheConnected();
  const [step, setStep] = useState(0);
  const [encryptStep, setEncryptStep] = useState(-1);
  const [form, setForm] = useState({
    title: "", description: "", previewText: "", fullContent: "",
    category: "skills", priceEth: "5.00",
    isSubscription: false, subscriptionDays: 30,
  });

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleDeploy() {
    if (!isConnected) { toast.error("Connect wallet first"); return; }
    setStep(2);
    try {
      // Simulate step progression
      for (let i = 0; i < ENCRYPT_STEPS.length; i++) {
        setEncryptStep(i);
        if (i < 2) await new Promise(r => setTimeout(r, 600));
      }
      await uploadContent({
        ...form,
        subscriptionDuration: form.isSubscription ? form.subscriptionDays * 86400 : 0,
      });
      toast.success("Content deployed!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setStep(1);
      setEncryptStep(-1);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 pt-12 pb-20">
      {/* Step indicator */}
      <div className="flex items-center gap-0 mb-10">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-manrope font-bold transition-all ${
                i < step ? "bg-secondary text-on-secondary" :
                i === step ? "bg-primary-container text-white" :
                "bg-surface-container text-on-surface-variant"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${
                i === step ? "text-primary" : "text-slate-500"
              }`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 mb-5 ${i < step ? "bg-secondary/50" : "bg-outline-variant/30"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Metadata */}
      {step === 0 && (
        <div className="glass-panel rounded-xl p-8 space-y-5">
          <h2 className="font-manrope text-2xl font-bold text-white mb-2">Asset Details</h2>
          <Field label="Title">
            <input className="input-field" value={form.title} onChange={set("title")} required placeholder="e.g. 30-Day Keto Protocol" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <select className="input-field" value={form.category} onChange={set("category")}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </Field>
            <Field label={form.isSubscription ? "Price (USDC / period)" : "Price (USDC)"}>
              <input className="input-field" type="number" step="0.001" min="0" value={form.priceEth} onChange={set("priceEth")} />
            </Field>
          </div>
          {/* Subscription toggle */}
          <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
            <div>
              <p className="text-sm font-semibold text-on-surface">Subscription pricing</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Buyers pay per time period instead of one-time</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, isSubscription: !f.isSubscription }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.isSubscription ? "bg-secondary" : "bg-outline-variant/50"}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${form.isSubscription ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
          {form.isSubscription && (
            <Field label="Subscription Duration">
              <select className="input-field" value={form.subscriptionDays} onChange={(e) => setForm(f => ({ ...f, subscriptionDays: Number(e.target.value) }))}>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>365 days</option>
              </select>
            </Field>
          )}
          <Field label="Short Description (public)">
            <input className="input-field" value={form.description} onChange={set("description")} placeholder="One-line summary shown in marketplace" />
          </Field>
          <button
            onClick={() => { if (!form.title || !form.description) { toast.error("Fill all fields"); return; } setStep(1); }}
            className="w-full bg-primary-container text-white font-manrope font-bold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all mt-2"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step 1: Content */}
      {step === 1 && (
        <div className="glass-panel rounded-xl p-8 space-y-5">
          <h2 className="font-manrope text-2xl font-bold text-white mb-2">Write Content</h2>
          <Field label="Preview Text (used by AI to answer buyer questions)">
            <textarea
              className="input-field h-28 resize-none"
              value={form.previewText}
              onChange={set("previewText")}
              placeholder="Write a teaser that gives buyers a taste. This is publicly visible and powers the AI chat."
            />
            <div className="mt-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">💡 Tips for better AI answers</p>
              <ul className="text-xs text-indigo-200/70 space-y-1 list-none">
                <li>• Mention the main topics, outcomes, or techniques covered</li>
                <li>• Include key terms buyers might search or ask about</li>
                <li>• State who the content is for (e.g. "for beginners", "for advanced traders")</li>
                <li>• The more specific your preview, the better the AI can answer buyer questions</li>
                <li>• This text is <span className="text-indigo-300 font-semibold">never shown publicly</span> — only the AI uses it</li>
              </ul>
            </div>
          </Field>
          <Field label="Full Content (markdown — will be FHE-encrypted)">
            <DragDropZone onContent={(text, name) => {
              setForm(f => ({ ...f, fullContent: text, title: f.title || name.replace(/\.(md|txt)$/, "") }));
            }} />
            <textarea
              className="input-field h-64 resize-none font-mono text-sm mt-3"
              value={form.fullContent}
              onChange={set("fullContent")}
              placeholder={"# Your full content here\n\nOnly buyers who pay will ever see this..."}
            />
          </Field>
          <div className="flex gap-3 mt-2">
            <button onClick={() => setStep(0)} className="flex-1 border border-outline-variant text-on-surface font-manrope font-semibold py-3 rounded-xl hover:bg-white/5 transition-all">
              ← Back
            </button>
            <button
              onClick={() => { if (!form.previewText || !form.fullContent) { toast.error("Fill all fields"); return; } handleDeploy(); }}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-manrope font-bold py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all"
            >
              Encrypt & Deploy
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Encrypting progress */}
      {step === 2 && (
        <div className="glass-panel rounded-xl p-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="font-manrope text-2xl font-bold text-white">Securing Your Content</h2>
            <p className="text-on-surface-variant text-sm">Do not close this window</p>
          </div>

          {/* Scanline animation */}
          <div className="relative h-1 bg-surface-container rounded-full overflow-hidden">
            <div className="scanline" />
          </div>

          <div className="space-y-3">
            {ENCRYPT_STEPS.map((s, i) => (
              <div key={i} className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                i < encryptStep ? "bg-secondary/10 border border-secondary/20" :
                i === encryptStep ? "bg-indigo-500/10 border border-indigo-500/30" :
                "bg-surface-container border border-transparent"
              }`}>
                <span className="text-xl">{s.icon}</span>
                <span className={`text-sm font-manrope font-semibold ${
                  i < encryptStep ? "text-secondary" :
                  i === encryptStep ? "text-primary" :
                  "text-slate-500"
                }`}>{s.label}</span>
                {i < encryptStep && <span className="ml-auto text-secondary text-sm">✓</span>}
                {i === encryptStep && (
                  <div className="ml-auto w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label-caps">{label}</label>
      {children}
    </div>
  );
}
