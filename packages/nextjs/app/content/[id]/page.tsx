"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import { useEncora } from "@/hooks/useEncora";
import { ContentInfo } from "@/src/contracts/encora";
import { PreviewChat } from "@/components/PreviewChat";
import { PurchaseButton } from "@/components/PurchaseButton";
import { AccessButton } from "@/components/AccessButton";
import { ContentViewer } from "@/components/ContentViewer";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const CATEGORY_COLORS: Record<string, string> = {
  diet: "bg-on-secondary-container text-secondary",
  fitness: "bg-on-secondary-container text-secondary",
  skills: "bg-on-primary-fixed-variant text-primary-fixed",
  finance: "bg-on-tertiary-container text-tertiary",
  code: "bg-on-secondary-fixed-variant text-secondary-fixed",
  health: "bg-on-secondary-container text-secondary",
  other: "bg-surface-container-high text-on-surface-variant",
};

export default function ContentPage() {
  const { id } = useParams<{ id: string }>();
  const { getContent, checkAccess } = useEncora();
  const { isConnected } = useAccount();
  const [content, setContent] = useState<ContentInfo | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [decryptedText, setDecryptedText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const contentId = BigInt(id);
    getContent(contentId).then(setContent).finally(() => setLoading(false));
    if (isConnected) checkAccess(contentId).then(setHasPaid);
  }, [id, isConnected, getContent, checkAccess]);

  if (loading) return (
    <div className="max-w-7xl mx-auto px-6 pt-12 grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="glass-card rounded-xl h-32 animate-pulse" />)}
      </div>
      <div className="lg:col-span-4"><div className="glass-card rounded-xl h-64 animate-pulse" /></div>
    </div>
  );

  if (!content) return (
    <div className="flex items-center justify-center h-64 text-on-surface-variant">Content not found.</div>
  );

  const catColor = CATEGORY_COLORS[content.category.toLowerCase()] || CATEGORY_COLORS.other;

  return (
    <div className="max-w-7xl mx-auto px-6 pt-12 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left column */}
      <div className="lg:col-span-8 space-y-6">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`${catColor} text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full`}>
              {content.category}
            </span>
            <span className="fhe-badge">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              FHE Verified
            </span>
          </div>
          <h1 className="font-manrope text-4xl font-black tracking-tight text-white leading-tight">
            {content.title}
          </h1>
          <p className="text-on-surface-variant text-base leading-relaxed max-w-3xl">
            {content.description}
          </p>
        </div>

        {/* Public Preview — hidden from UI, used only by AI chat */}

        {/* AI Chat */}
        <PreviewChat contentId={content.id} previewText={content.previewText} />

        {/* Decrypted content */}
        {decryptedText && <ContentViewer markdown={decryptedText} />}
      </div>

      {/* Right column — sticky pricing card */}
      <div className="lg:col-span-4">
        <div className="sticky top-24 space-y-4">
          {/* Price card */}
          <div className="glass-panel rounded-xl p-6 space-y-5 hover:border-indigo-500/30 transition-all">
            <div className="flex justify-between items-end">
              <div className="space-y-1">
                <span className="label-caps">Access Price</span>
                <div className="font-manrope text-3xl font-black text-white">
                  {formatUnits(content.price, 6)} USDC
                </div>
              </div>
            </div>

            {!isConnected ? (
              <div className="w-full">
                <ConnectButton.Custom>
                  {({ openConnectModal }) => (
                    <button onClick={openConnectModal} className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 py-4 rounded-xl font-manrope font-bold text-white uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all">
                      Connect Wallet
                    </button>
                  )}
                </ConnectButton.Custom>
              </div>
            ) : !hasPaid ? (
              <PurchaseButton content={content} onPurchased={() => setHasPaid(true)} />
            ) : !decryptedText ? (
              <AccessButton content={content} onDecrypted={setDecryptedText} />
            ) : (
              <div className="w-full py-4 rounded-xl bg-secondary/10 border border-secondary/30 text-center text-secondary font-manrope font-bold text-sm uppercase tracking-widest">
                ✓ Content Unlocked
              </div>
            )}

            <div className="flex items-center justify-between text-sm text-slate-500 border-t border-white/5 pt-4">
              <span>Platform Fee</span><span>2.5%</span>
            </div>
          </div>

          {/* FHE info */}
          <div className="bg-secondary/10 border border-secondary/20 p-5 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-secondary">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="label-caps text-secondary">FHE Protected</span>
            </div>
            <p className="text-secondary/80 text-xs leading-relaxed">
              Secured via Fully Homomorphic Encryption. Your decryption key is generated on-chain upon purchase — even the marketplace cannot access the content without your authorization.
            </p>
          </div>

          {/* Seller info */}
          <div className="glass-panel rounded-xl p-5 space-y-3">
            <span className="label-caps">Seller</span>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-primary font-manrope font-bold text-sm">
                {content.seller.slice(2, 4).toUpperCase()}
              </div>
              <span className="font-mono text-sm text-on-surface-variant">
                {content.seller.slice(0, 6)}…{content.seller.slice(-4)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
