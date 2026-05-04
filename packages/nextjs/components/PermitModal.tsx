"use client";

import { useState } from "react";
import { getCofheClient } from "@/services/cofhe-client";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";

export function PermitModal({ onClose }: { onClose: () => void }) {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);

  async function handleSign() {
    if (!address) return;
    setLoading(true);
    try {
      await getCofheClient().permits.createSelf({ issuer: address, name: "Encora" });
      toast.success("Permit signed!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sign permit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="glass-panel rounded-2xl p-8 max-w-sm w-full border border-white/10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="font-manrope text-lg font-bold text-white">Sign a Permit</h2>
        </div>

        <p className="text-on-surface-variant text-sm leading-relaxed mb-5">
          A permit authenticates you to decrypt FHE-sealed content. It&apos;s a wallet signature — no gas required.
        </p>

        <ul className="space-y-2 mb-6">
          {["Valid for 24 hours", "Only usable by you", "Required to unseal purchased content"].map(item => (
            <li key={item} className="flex items-center gap-2 text-xs text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-outline-variant text-on-surface font-manrope font-semibold py-2.5 rounded-xl hover:bg-white/5 transition-all text-sm">
            Cancel
          </button>
          <button onClick={handleSign} disabled={loading}
            className="flex-1 bg-primary-container text-white font-manrope font-bold py-2.5 rounded-xl hover:brightness-110 disabled:opacity-50 active:scale-95 transition-all text-sm">
            {loading ? "Signing…" : "Sign Permit"}
          </button>
        </div>
      </div>
    </div>
  );
}
