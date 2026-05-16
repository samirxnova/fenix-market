"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV = [
  { href: "/", label: "Marketplace" },
  { href: "/upload", label: "Sell" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/purchases", label: "Purchases" },
];

export function Navbar() {
  const path = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-16 bg-[#16161e]/80 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-black tracking-tighter text-white uppercase font-manrope">
          Encora
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {NAV.map(({ href, label }) => {
            const active = path === href || (href !== "/" && path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`font-manrope text-sm font-semibold tracking-tight transition-colors ${
                  active
                    ? "text-primary border-b-2 border-primary pb-1"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {mounted && (
        <ConnectButton
          showBalance={false}
          chainStatus="none"
          accountStatus="address"
        />
      )}
    </header>
  );
}
