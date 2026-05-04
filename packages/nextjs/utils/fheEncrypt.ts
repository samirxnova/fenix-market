import { Encryptable } from "@cofhe/sdk";
import { getCofheClient } from "@/services/cofhe-client";

/** Encrypt 8 uint32 key chunks via cofhejs for on-chain FHE storage */
export async function encryptKeyChunks(chunks: number[]) {
  if (chunks.length !== 8) throw new Error("Expected 8 chunks");
  const client = getCofheClient();
  const result = await client
    .encryptInputs(chunks.map((c) => Encryptable.uint32(BigInt(c))))
    .execute();
  return result; // InEuint32[8] — pass directly to contract
}
