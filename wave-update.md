# Encora — Wave Submission

## Links
- Frontend Demo — https://encora-three.vercel.app/
- Contract (Arb Sepolia) — https://sepolia.arbiscan.io/address/0xb30714F68002F901406d68B9648ABb9851F0d318

## The Gap We Closed

Knowledge marketplaces run on trust — buyers trust seller claims, sellers trust buyers won't redistribute. Neither holds on-chain. Encora closes both with FHE: content is encrypted before it leaves the browser, and the decryption key is generated on-chain only after payment. Not even the marketplace can read it.

But we went further: **who bought what is also private.** Purchase counts are FHE-encrypted (only the seller can see them). Subscription expiry is FHE-encrypted (only the buyer knows when it expires). The marketplace can't surveil its own users.

## How It Works

**Two-layer encryption.** The seller's full text is AES-256-GCM encrypted in the browser. The ciphertext is uploaded to IPFS via Pinata — only the CID is stored on-chain. The AES key is split into 8 × `euint32` chunks, CoFHE-encrypted, and stored in `EncoraV3.sol` with `FHE.allowThis` so the contract can grant future buyers.

**Buyer-gated decryption.** After paying in USDC, the buyer calls `requestAccess`. The contract calls `FHE.allow(chunk, buyer)` for each key chunk. The buyer unseals them client-side via `cofhejs` using a self-permit (EIP-712, no gas), reassembles the AES key, fetches encrypted content from IPFS, and decrypts locally.

**Confidential subscriptions.** Content can be subscription-based (7/30/90/365 days). The expiry timestamp is stored as FHE-encrypted `euint64` — only the buyer can decrypt it. The `/subscriptions` page shows the buyer's private feed, decrypted entirely in their browser.

**Confidential analytics.** Purchase counts per content are FHE-encrypted `euint32` — only the seller can decrypt them on their dashboard. Competitors and observers see nothing.

**AI-powered discovery.** Sellers write a `previewText` (never shown publicly). It powers an OpenRouter AI chat widget so visitors can ask questions before buying.

## What We Shipped

- **`EncoraV3.sol`** on Arbitrum Sepolia — subscriptions with FHE-encrypted expiry, FHE-encrypted purchase counts, IPFS content storage, USDC payment
- **IPFS via Pinata** — encrypted content stored on IPFS, only CID on-chain (removes size limits)
- **Drag & drop upload** — drop `.md`/`.txt` files into the upload wizard
- **Confidential subscriptions** — `subscribe()`, `renewSubscription()`, `getMySubscriptions()` with `euint64` expiry
- **Confidential analytics** — `purchaseCount` as `euint32`, `getMyAnalytics()` seller-only
- **Private purchase history** — `purchasesByBuyer` mapping removed, uses event logs only
- **Subscription UI** — toggle in upload form, `/subscriptions` page with FHE-decrypted feed
- **CoFHE SDK v0.5.1** — `decryptForView().withPermit()` for both `Uint32` and `Uint64` types

## What's Next

Confidential ratings (FHE-encrypted individual votes, aggregate-only reveal) and Phala TEE AI integration (encrypted preview decrypted only inside TEE, zero plaintext anywhere).
