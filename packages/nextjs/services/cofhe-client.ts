import { createCofheConfig, createCofheClient } from "@cofhe/sdk/web";
import { chains } from "@cofhe/sdk/chains";

type CofheClientInstance = ReturnType<typeof createCofheClient>;
let _instance: CofheClientInstance | null = null;

export function getCofheClient(): CofheClientInstance {
  if (typeof window === "undefined") throw new Error("CoFHE client is browser-only");
  if (!_instance) {
    _instance = createCofheClient(
      createCofheConfig({ supportedChains: [chains.arbSepolia, chains.baseSepolia] })
    );
  }
  return _instance;
}

export const cofheClient = new Proxy({} as CofheClientInstance, {
  get(_t, prop) {
    return getCofheClient()[prop as keyof CofheClientInstance];
  },
});
