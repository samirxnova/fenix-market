"use client";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/services/web3/wagmiConfig";
import { useCofhe } from "@/hooks/useCofhe";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

function CofheInit() {
  useCofhe(); // initializes cofhejs when wallet connects
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <CofheInit />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
