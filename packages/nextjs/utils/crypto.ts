// AES-GCM symmetric encryption for text content.
// All operations run in the browser via the Web Crypto API.
// Encrypted format: iv (12 bytes) ++ ciphertext (variable)

const ALGO = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export async function generateSymKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGO, length: KEY_LENGTH }, true, ["encrypt", "decrypt"]);
}

export async function encryptText(text: string, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    new TextEncoder().encode(text)
  );
  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_LENGTH);
  return result;
}

export async function decryptText(ivAndCiphertext: Uint8Array, key: CryptoKey): Promise<string> {
  const iv = ivAndCiphertext.slice(0, IV_LENGTH);
  const ciphertext = ivAndCiphertext.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer, { name: ALGO }, false, ["decrypt"]);
}

/** Split a 32-byte key into 8 × uint32 (big-endian) */
export function keyToUint32Chunks(keyBytes: Uint8Array): number[] {
  if (keyBytes.length !== 32) throw new Error("Key must be 32 bytes");
  const view = new DataView(keyBytes.buffer, keyBytes.byteOffset, keyBytes.byteLength);
  return Array.from({ length: 8 }, (_, i) => view.getUint32(i * 4, false));
}

/** Reassemble 8 × uint32 chunks (big-endian) into a 32-byte key */
export function uint32ChunksToKey(chunks: bigint[]): Uint8Array {
  if (chunks.length !== 8) throw new Error("Expected 8 chunks");
  const buf = new ArrayBuffer(32);
  const view = new DataView(buf);
  chunks.forEach((c, i) => view.setUint32(i * 4, Number(c & 0xffffffffn), false));
  return new Uint8Array(buf);
}
