"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEncora } from "@/hooks/useEncora";
import { ContentInfo } from "@/src/contracts/encora";
import { formatUnits } from "viem";
import { FheTypes } from "@cofhe/sdk";
import { getCofheClient } from "@/services/cofhe-client";
import { useAccount } from "wagmi";

interface SubItem {
  content: ContentInfo;
  expiresAt: number;
  isActive: boolean;
}

export default function SubscriptionsPage() {
  const { listContents, getMySubscriptions } = useEncora();
  const { address } = useAccount();
  const [subs, setSubs] = useState<SubItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) { setLoading(false); return; }

    async function load() {
      try {
        // Get all content, filter subscription-based
        const all = await listContents(0n, 100n);
        const subContent = all.filter(c => c.subscriptionDuration > 0n);
        if (subContent.length === 0) { setLoading(false); return; }

        // Get encrypted expiries for all subscription content
        const ids = subContent.map(c => c.id);
        const handles = await getMySubscriptions(ids);

        // Unseal each expiry — only buyer can decrypt
        const client = getCofheClient();
        const now = Math.floor(Date.now() / 1000);
        const items: SubItem[] = [];

        for (let i = 0; i < handles.length; i++) {
          if (handles[i] === 0n) continue; // no subscription for this content
          try {
            const expiry = await client.decryptForView(handles[i], FheTypes.Uint64).withPermit().execute();
            const expiresAt = Number(expiry);
            items.push({
              content: subContent[i],
              expiresAt,
              isActive: expiresAt > now,
            });
          } catch { /* can't decrypt — not subscribed or permit issue */ }
        }

        setSubs(items);
      } catch (err) {
        console.error("Failed to load subscriptions:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [address, listContents, getMySubscriptions]);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
      <div className="mb-8">
        <h1 className="font-manrope text-3xl font-black text-white">My Subscriptions</h1>
        <p className="text-on-surface-variant text-sm mt-1">Your private subscription feed — decrypted only in your browser</p>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <span className="label-caps">{subs.filter(s => s.isActive).length} active subscriptions</span>
          <div className="fhe-badge">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            FHE Private
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-surface-container rounded-xl animate-pulse" />)}
          </div>
        ) : subs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-on-surface-variant mb-4">No subscriptions yet.</p>
            <Link href="/" className="text-primary hover:underline font-manrope font-semibold text-sm">
              Browse subscription content →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {subs.map(({ content: c, expiresAt, isActive }) => (
              <Link key={c.id.toString()} href={`/content/${c.id}`}
                className="flex items-center justify-between px-6 py-5 hover:bg-white/3 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${isActive ? "bg-secondary" : "bg-error"}`} />
                  <div>
                    <p className="font-manrope font-semibold text-white group-hover:text-primary transition-colors text-sm">
                      {c.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isActive
                        ? `Expires ${new Date(expiresAt * 1000).toLocaleDateString()}`
                        : `Expired ${new Date(expiresAt * 1000).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm text-on-surface-variant">
                    {formatUnits(c.price, 6)} USDC / {Number(c.subscriptionDuration) / 86400}d
                  </span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                    isActive ? "bg-secondary/15 text-secondary" : "bg-error/15 text-error"
                  }`}>
                    {isActive ? "Active" : "Expired"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
