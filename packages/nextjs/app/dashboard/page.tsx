"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEncora } from "@/hooks/useEncora";
import { ContentInfo } from "@/src/contracts/encora";
import { formatUnits } from "viem";
import { unsealKeyChunks } from "@/utils/unseal";
import toast from "react-hot-toast";

export default function DashboardPage() {
  const { getMyUploads, getContent, getSellerBalance, withdraw, getMyAnalytics } = useEncora();
  const [uploads, setUploads] = useState<ContentInfo[]>([]);
  const [balance, setBalance] = useState(0n);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [purchaseCounts, setPurchaseCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      getMyUploads().then(async (ids) => {
        const contents = await Promise.all(ids.map(getContent));
        setUploads(contents);
        // Try to unseal encrypted purchase counts (only works if seller has permit)
        if (ids.length > 0) {
          try {
            const handles = await getMyAnalytics(ids);
            if (handles.length > 0) {
              const { FheTypes } = await import("@cofhe/sdk");
              const { getCofheClient } = await import("@/services/cofhe-client");
              const client = getCofheClient();
              const counts: Record<string, number> = {};
              for (let i = 0; i < handles.length; i++) {
                try {
                  const val = await client.decryptForView(handles[i], FheTypes.Uint32).withPermit().execute();
                  counts[ids[i].toString()] = Number(val);
                } catch { counts[ids[i].toString()] = -1; } // -1 = couldn't decrypt
              }
              setPurchaseCounts(counts);
            }
          } catch { /* analytics not available — V1 contract or no permit */ }
        }
      }),
      getSellerBalance().then(setBalance),
    ]).finally(() => setLoading(false));
  }, [getMyUploads, getContent, getSellerBalance, getMyAnalytics]);

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      await withdraw();
      toast.success("Withdrawn!");
      setBalance(0n);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Withdraw failed");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-manrope text-3xl font-black text-white">Seller Dashboard</h1>
          <p className="text-on-surface-variant text-sm mt-1">Manage your encrypted content listings</p>
        </div>
        <Link href="/upload" className="bg-primary-container text-white font-manrope font-bold px-5 py-2.5 rounded-xl hover:brightness-110 active:scale-95 transition-all text-sm">
          + New Asset
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Earnings card */}
        <div className="glass-panel rounded-xl p-6 md:col-span-1">
          <span className="label-caps block mb-3">Pending Earnings</span>
          <div className="font-manrope text-4xl font-black text-white mb-4">
            {formatUnits(balance, 6)} <span className="text-xl text-on-surface-variant">USDC</span>
          </div>
          {balance > 0n ? (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-manrope font-bold py-2.5 rounded-xl hover:brightness-110 disabled:opacity-50 active:scale-95 transition-all text-sm"
            >
              {withdrawing ? "Withdrawing…" : "Withdraw Funds"}
            </button>
          ) : (
            <div className="text-xs text-slate-500 font-mono">No pending balance</div>
          )}
        </div>

        <div className="glass-panel rounded-xl p-6 flex flex-col justify-between">
          <span className="label-caps">Total Listings</span>
          <span className="font-manrope text-4xl font-black text-white mt-3">{uploads.length}</span>
        </div>

        <div className="glass-panel rounded-xl p-6 flex flex-col justify-between">
          <span className="label-caps">Active Listings</span>
          <span className="font-manrope text-4xl font-black text-secondary mt-3">
            {uploads.filter(u => u.active).length}
          </span>
        </div>
      </div>

      {/* Content list */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <span className="font-manrope font-bold text-white">Your Assets</span>
          <span className="label-caps">{uploads.length} total</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-surface-container rounded-xl animate-pulse" />)}
          </div>
        ) : uploads.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-on-surface-variant mb-4">No uploads yet.</p>
            <Link href="/upload" className="text-primary hover:underline font-manrope font-semibold text-sm">
              Upload your first asset →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {uploads.map(c => (
              <Link key={c.id.toString()} href={`/content/${c.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${c.active ? "bg-secondary" : "bg-slate-600"}`} />
                  <div>
                    <p className="font-manrope font-semibold text-white group-hover:text-primary transition-colors text-sm">
                      {c.title}
                    </p>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mt-0.5">{c.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className="font-mono text-sm text-on-surface-variant">{formatUnits(c.price, 6)} USDC</span>
                  {purchaseCounts[c.id.toString()] !== undefined && purchaseCounts[c.id.toString()] >= 0 && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-indigo-500/15 text-indigo-300">
                      {purchaseCounts[c.id.toString()]} sales
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                    c.active ? "bg-secondary/15 text-secondary" : "bg-surface-container text-slate-500"
                  }`}>
                    {c.active ? "Active" : "Inactive"}
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
