import { FheTypes } from "@cofhe/sdk";
import { getCofheClient } from "@/services/cofhe-client";

/** Unseal 8 FHE-sealed euint32 handles returned from requestAccess.
 *  Requires an active cofhejs permit for the current account. */
export async function unsealKeyChunks(sealedHandles: bigint[]): Promise<bigint[]> {
  if (sealedHandles.length !== 8) throw new Error("Expected 8 handles");
  const client = getCofheClient();
  const results = await Promise.all(
    sealedHandles.map((handle) =>
      client.decryptForView(handle, FheTypes.Uint32).withPermit().execute()
    )
  );
  return results as bigint[];
}
