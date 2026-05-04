"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { cofheClient, getCofheClient } from "@/services/cofhe-client";
import { useCofheStore } from "@/services/store/cofheStore";

export function useCofhe() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useAccount();
  const { setIsInitialized } = useCofheStore();
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!isConnected || !publicClient || !walletClient) {
      setIsInitialized(false);
      return;
    }
    let cancelled = false;
    setIsInitializing(true);
    setError(null);

    cofheClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .connect(publicClient as any, walletClient as any)
      .then(() => { if (!cancelled) setIsInitialized(true); })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsInitialized(false);
      })
      .finally(() => { if (!cancelled) setIsInitializing(false); });

    return () => { cancelled = true; };
  }, [isConnected, publicClient, walletClient, setIsInitialized]);

  return { isInitialized: useCofheConnected(), isInitializing, error };
}

const getSnapshot = () => { try { return getCofheClient().getSnapshot(); } catch { return null; } };
const subscribe = (cb: () => void) => { try { return getCofheClient().subscribe(cb); } catch { return () => {}; } };

export function useCofheConnected() {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return !!state?.connected;
}
