# Encora — Wave Submission

## Links
- Frontend Demo — https://encora-three.vercel.app/
- Contract (Arb Sepolia) — https://sepolia.arbiscan.io/address/0x072CbfC304e41F0e73A09721203Ac2059a0Cb03e

## What We Built

**The Gap We Closed.** Knowledge has always been sold on trust — buyers trust the seller's claims, and sellers trust that buyers won't redistribute their work. Neither holds on-chain. Encora closes both gaps with Fully Homomorphic Encryption: the seller's content is encrypted before it ever leaves the browser, and the buyer's decryption key is generated on-chain only after payment, with cryptographic guarantees that not even the marketplace can read the content.

**Two-layer encryption, zero server trust.** The seller writes their content in the browser. A random AES-256-GCM key encrypts the full text client-side; the ciphertext is stored on-chain as public bytes — meaningless without the key. The AES key is then split into 8 × `euint32` chunks and CoFHE-encrypted on-chain in `Encora.sol`, with `FHE.allowThis` ensuring the contract retains access to grant future buyers. No server, no backend, no database ever sees the plaintext.

**Buyer-gated decryption.** When a buyer pays in USDC and calls `requestAccess`, the contract calls `FHE.allow(chunk, buyer)` for each of the 8 key chunks. The buyer unseals them client-side via `cofhejs` using a self-permit (EIP-712, no gas), reassembles the AES key, and decrypts the content entirely in the browser. A nullifier set (`usedPubKeys`) prevents any public key from being reused — binding each decryption to a single key pair.

**AI-powered discovery.** Sellers write a `previewText` that is never shown publicly. It feeds an OpenRouter-powered AI chat widget (edge-streamed, server-side API key) so any visitor can ask questions about the content before buying. The AI is scoped strictly to the preview — the encrypted content never reaches the server.

## What We Shipped

- **`Encora.sol`** deployed on Arbitrum Sepolia — CoFHE-gated AES key management with `euint32` chunks, USDC payment, nullifier set, and seller withdrawal
- **CoFHE SDK v0.5.1** — fully migrated with `decryptForView().withPermit()` self-permit flow for client-side unsealing
- **Two-layer encryption pipeline** — browser AES-GCM encryption + `cofhejs` FHE key chunk encryption, all client-side
- **USDC payment flow** — ERC-20 approve + purchase with live EIP-1559 gas fee fetching (fixes Arbitrum Sepolia base fee spikes)
- **AI chat widget** — OpenRouter streaming chat scoped to preview text only, 10-message session rate limit, no wallet required
- **Full marketplace UI** — glassmorphic dark design system (Manrope/Inter/Space Grotesk), marketplace grid, 3-step upload wizard with encryption progress animation, content detail with sticky pricing card, seller dashboard with USDC withdrawal, buyer purchases page

## What's Next

Expanding content types beyond text/markdown to support structured data (JSON datasets, model weights) using the same two-layer encryption pattern. Adding seller reputation scores and content ratings stored as FHE-encrypted aggregates to prevent manipulation.