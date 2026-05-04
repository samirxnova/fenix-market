"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useEncora } from "@/hooks/useEncora";
import { ContentInfo } from "@/src/contracts/encora";
import { formatUnits } from "viem";

const CATEGORIES = ["All", "Diet", "Fitness", "Skills", "Finance", "Code", "Health", "Other"];

const CATEGORY_COLORS: Record<string, string> = {
  diet: "bg-on-secondary-container text-secondary",
  fitness: "bg-on-secondary-container text-secondary",
  skills: "bg-on-primary-fixed-variant text-primary-fixed",
  finance: "bg-on-tertiary-container text-tertiary",
  code: "bg-on-secondary-fixed-variant text-secondary-fixed",
  health: "bg-on-secondary-container text-secondary",
  other: "bg-surface-container-high text-on-surface-variant",
};

export default function MarketplacePage() {
  const { listContents, listByCategory } = useEncora();
  const [contents, setContents] = useState<ContentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    setLoading(true);
    const fetch = activeCategory === "All"
      ? listContents()
      : listByCategory(activeCategory.toLowerCase());
    fetch.then(setContents).finally(() => setLoading(false));
  }, [activeCategory, listContents, listByCategory]);

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="px-6 pt-16 pb-16 max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="font-manrope text-5xl font-black tracking-tight leading-tight mb-6">
            Buy and sell knowledge,{" "}
            <span className="hero-gradient-text">privately.</span>
          </h1>
          <p className="text-on-surface-variant text-base leading-relaxed max-w-lg mb-8">
            The world&apos;s first FHE-encrypted marketplace for proprietary data, strategies, and digital knowledge. Trade with absolute cryptographic certainty.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/upload" className="bg-primary-container text-white font-manrope font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-500/20 hover:brightness-110 active:scale-95 transition-all">
              Start Selling
            </Link>
            <button className="border border-outline-variant text-on-surface font-manrope font-bold py-3 px-8 rounded-xl hover:bg-white/5 transition-all">
              Browse Docs
            </button>
          </div>
        </div>
        <div className="relative group hidden lg:block">
          <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full group-hover:bg-indigo-500/30 transition-all" />
          <div className="relative aspect-video rounded-xl overflow-hidden glass-card flex items-center justify-center">
            <div className="text-center space-y-3 p-8">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="font-manrope font-bold text-white">FHE Protected</p>
              <p className="text-on-surface-variant text-sm">End-to-end encrypted knowledge marketplace</p>
            </div>
          </div>
        </div>
      </section>

      <div className="px-6 max-w-7xl mx-auto">
        {/* Category Filters */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar mb-10">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-5 py-2 rounded-full text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant border border-outline-variant/30 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card rounded-xl p-5 h-72 animate-pulse" />
            ))}
          </div>
        ) : contents.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-on-surface-variant mb-4">No content yet in this category.</p>
            <Link href="/upload" className="text-primary hover:underline font-manrope font-semibold">
              Be the first to upload →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contents.map((c) => (
              <ContentCard key={c.id.toString()} content={c} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <Link href="/upload" className="fixed bottom-8 right-8 bg-primary text-on-primary w-14 h-14 rounded-full shadow-2xl shadow-primary/40 flex items-center justify-center hover:brightness-110 active:scale-90 transition-all z-40">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </Link>
    </div>
  );
}

function ContentCard({ content }: { content: ContentInfo }) {
  const catKey = content.category.toLowerCase();
  const catColor = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.other;

  return (
    <Link href={`/content/${content.id}`} className="glass-card rounded-xl p-5 flex flex-col group block">
      {/* Top meta row */}
      <div className="flex items-center justify-between mb-4">
        <span className={`${catColor} text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded`}>
          {content.category}
        </span>
        <div className="fhe-badge">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          FHE Protected
        </div>
      </div>

      <h3 className="font-manrope text-lg font-bold text-white group-hover:text-primary transition-colors mb-2 line-clamp-2">
        {content.title}
      </h3>
      <p className="text-on-surface-variant text-sm leading-relaxed line-clamp-2 mb-6 flex-1">
        {content.description}
      </p>

      <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-auto">
        <div>
          <span className="label-caps block mb-0.5">Price</span>
          <span className="font-mono text-lg font-semibold text-white">{formatUnits(content.price, 6)} USDC</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500">
            {content.seller.slice(0, 6)}…{content.seller.slice(-4)}
          </span>
          <div className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
