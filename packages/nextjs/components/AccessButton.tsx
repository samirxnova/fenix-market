"use client";

import { useState } from "react";
import { useEncora } from "@/hooks/useEncora";
import { ContentInfo } from "@/src/contracts/encora";
import toast from "react-hot-toast";

export function AccessButton({ content, onDecrypted }: { content: ContentInfo; onDecrypted: (text: string) => void }) {
  const { requestAndDecrypt } = useEncora();
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleAccess() {
    setLoading(true);
    setErrMsg(null);
    try {
      const text = await requestAndDecrypt(content);
      onDecrypted(text);
      setUnlocked(true);
      toast.success("Content unlocked!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Access failed";
      setErrMsg(msg);
      toast.error(msg);
      console.error("requestAndDecrypt error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (unlocked) {
    return (
      <div className="w-full py-4 rounded-xl bg-secondary/10 border border-secondary/30 text-center text-secondary font-manrope font-bold text-sm uppercase tracking-widest">
        ✓ Unlocked
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <button
        onClick={handleAccess}
        disabled={loading}
        className="w-full bg-gradient-to-r from-secondary/80 to-secondary py-4 rounded-xl font-manrope font-bold text-on-secondary uppercase tracking-widest hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        {loading ? (
          <><div className="w-4 h-4 border-2 border-on-secondary border-t-transparent rounded-full animate-spin" /> Decrypting…</>
        ) : (
          <>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
            </svg>
            Unlock Content
          </>
        )}
      </button>
      {errMsg && <p className="text-xs text-error text-center break-all px-1">{errMsg}</p>}
    </div>
  );
}
