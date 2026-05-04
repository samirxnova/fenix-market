// Fetch live EIP-1559 fee params from the chain.
// The cofhe SDK hardcodes 20 Mwei as default which is below Arbitrum Sepolia's
// base fee when it spikes, causing "max fee per gas less than block base fee".

import type { PublicClient } from "viem";

export async function getGasFees(publicClient: PublicClient) {
  const fees = await publicClient.estimateFeesPerGas();
  return {
    maxFeePerGas: fees.maxFeePerGas ?? 100_000_000n,
    // Arbitrum Sepolia returns 0n for priority fee — fall back to 1 Mwei
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas || 1_000_000n,
  };
}
