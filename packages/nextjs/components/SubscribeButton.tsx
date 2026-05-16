"use client";

import { useState } from "react";
import { useEncora } from "@/hooks/useEncora";
import { ContentInfo } from "@/src/contracts/encora";
import { formatUnits } from "viem";
import toast from "react-hot-toast";

export function SubscribeButton({ content, onSubscribed }: { content: ContentInfo; onSubscribed: () => void }) {
  const { subscribeContent } = useEncora();
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    setLoading(true);
    try {
      await subscribeContent(content.id, content.price);
      toast.success("Subscribed!");
      onSubscribed();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Subscribe failed");
    } finally {
      setLoading(false);
    }
  }

  const days = Number(content.subscriptionDuration) / 86400;

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-xl font-manrope font-bold text-white uppercase tracking-widest hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
    >
      {loading ? (
        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Processing…</>
      ) : (
        `Subscribe · ${formatUnits(content.price, 6)} USDC / ${days}d`
      )}
    </button>
  );
}
