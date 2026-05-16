# Encora

**Privacy-preserving knowledge marketplace powered by Fully Homomorphic Encryption (FHE)**

Sellers upload text/markdown content — diet plans, skill guides, trading strategies, tutorials — protected by two-layer encryption. Buyers pay in USDC and decrypt content entirely client-side. Not even the marketplace can read it. Purchase history, subscription status, and analytics are all FHE-encrypted — nobody can see who bought what.

---

## How It Works

```
Seller                    EncoraV3 Contract (Arb Sepolia)      Buyer
  │                                │                              │
  │── uploadContent(               │                              │
  │     previewText,               │                              │
  │     IPFS(AES(fullText)),       │                              │
  │     FHE(aesKey),               │                              │
  │     subscriptionDuration) ────►│                              │
  │                                │  previewText → AI chat ─────►│
  │                                │◄─ purchase/subscribe (USDC) ─│
  │                                │◄─ requestAccess(pubKey) ─────│
  │                                │  FHE.allow(keyChunks, buyer) │
  │                                │── sealedKeyChunks ──────────►│
  │                                │  unseal → AES key            │
  │                                │  fetch IPFS → decrypt locally│
```

### Two-Layer Encryption

**Layer 1 — AES-GCM (browser, off-chain):**
Seller encrypts the full text with a random 256-bit AES key in the browser. The ciphertext is uploaded to IPFS via Pinata. Only the CID is stored on-chain — unreadable without the key.

**Layer 2 — FHE (on-chain, Fhenix CoFHE):**
The AES key is split into 8 × `euint32` chunks and stored as FHE ciphertext. When a buyer pays and provides their sealing public key, the contract calls `FHE.allow(chunk, buyer)` for each chunk. The buyer unseals them client-side via `cofhejs`, reassembles the AES key, fetches encrypted content from IPFS, and decrypts locally.

### Privacy Model

| Data | Visibility |
|------|-----------|
| Content title, description, category, price | Public |
| Encrypted content (IPFS CID) | Public (useless without key) |
| **Who bought which content** | **Private** — event logs only |
| **Subscription expiry** | **FHE-encrypted** — only buyer can decrypt |
| **Purchase counts per content** | **FHE-encrypted** — only seller can decrypt |
| **AI preview text** | Never shown publicly — AI-only context |

### AI Chat
The seller writes a `previewText` (never shown publicly). It's used as context for an OpenRouter-powered AI chat widget — any visitor can ask questions about the content before buying.

### Subscriptions
Content can be one-time purchase or subscription-based. Subscription expiry is stored as FHE-encrypted `euint64` — only the buyer can see when their subscription expires. The buyer's subscription feed is decrypted entirely in their browser.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Solidity 0.8.25, Fhenix CoFHE (`@fhenixprotocol/cofhe-contracts`) |
| FHE client | `@cofhe/sdk` 0.5.1 |
| Frontend | Next.js 14, Tailwind CSS, wagmi v2, RainbowKit |
| Payment | USDC ERC-20 (Arbitrum Sepolia) |
| Storage | Pinata IPFS (encrypted content) |
| AI chat | OpenRouter (OpenAI-compatible, `gpt-4o-mini`) |
| Network | Arbitrum Sepolia (testnet) |

---

## Contracts

| Item | Value |
|------|-------|
| EncoraV3 (latest) | `0xb30714F68002F901406d68B9648ABb9851F0d318` |
| USDC (Arb Sepolia) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| Network | Arbitrum Sepolia (Chain ID: 421614) |

---

## Project Structure

```
encora/
├── packages/
│   ├── hardhat/                  # Smart contracts
│   │   ├── contracts/
│   │   │   ├── Encora.sol        # V1 contract
│   │   │   ├── EncoraV2.sol      # V2 + FHE analytics
│   │   │   └── EncoraV3.sol      # V3 + subscriptions (latest)
│   │   ├── test/
│   │   │   └── Encora.test.ts
│   │   ├── deploy/
│   │   │   └── 001_deploy_encora.ts
│   │   └── hardhat.config.ts
│   └── nextjs/                   # Frontend
│       ├── app/
│       │   ├── page.tsx          # Marketplace
│       │   ├── upload/           # Seller upload (3-step wizard + subscription toggle)
│       │   ├── content/[id]/     # Content detail + AI chat + purchase/subscribe + unlock
│       │   ├── dashboard/        # Seller dashboard + FHE analytics + withdraw
│       │   ├── purchases/        # Buyer purchases (event-based)
│       │   ├── subscriptions/    # Buyer's private subscription feed (FHE-decrypted)
│       │   └── api/
│       │       ├── chat/         # OpenRouter AI proxy (edge)
│       │       └── upload-url/   # Pinata presigned upload URL
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── Providers.tsx
│       │   ├── PreviewChat.tsx
│       │   ├── ContentViewer.tsx
│       │   ├── PurchaseButton.tsx
│       │   ├── SubscribeButton.tsx
│       │   ├── AccessButton.tsx
│       │   ├── DragDropZone.tsx
│       │   └── PermitModal.tsx
│       ├── hooks/
│       │   ├── useEncora.ts      # All contract interactions
│       │   ├── useCofhe.ts       # FHE client init
│       │   └── usePreviewChat.ts # AI chat streaming
│       └── utils/
│           ├── crypto.ts         # AES-GCM encrypt/decrypt
│           ├── fheEncrypt.ts     # FHE key chunk encryption
│           ├── unseal.ts         # FHE unsealing with permit
│           ├── gas.ts            # Live EIP-1559 gas fees
│           └── pinata.ts         # Pinata SDK instance
├── plan.md
├── features-plan.md
├── TESTING_GUIDE.md
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- MetaMask with Arbitrum Sepolia network
- Testnet ETH (for gas) — [Arbitrum faucet](https://faucet.arbitrum.io)
- Testnet USDC — [Circle faucet](https://faucet.circle.com)
- OpenRouter API key — [openrouter.ai](https://openrouter.ai)
- WalletConnect project ID — [cloud.walletconnect.com](https://cloud.walletconnect.com)
- Pinata account — [pinata.cloud](https://pinata.cloud)

### Install

```bash
cd packages/hardhat && npm install
cd ../nextjs && npm install
```

### Run Frontend

```bash
cp packages/nextjs/.env.example packages/nextjs/.env
# Fill in all env vars (see below)
cd packages/nextjs && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy Contract

```bash
cd packages/hardhat
cp .env.example .env
# Fill in PRIVATE_KEY and ARB_SEPOLIA_RPC_URL
npx hardhat deploy --network arb-sepolia
```

---

## User Flows

### Seller: Upload Content
1. Connect wallet → navigate to **Sell**
2. Fill metadata (title, category, price in USDC, description)
3. Toggle **Subscription pricing** if desired (7/30/90/365 days)
4. Write preview text (AI context — never shown publicly)
5. Write or drag-drop full content in markdown
6. Click **Encrypt & Deploy** → AES-encrypts → uploads to IPFS → FHE-encrypts key → stores CID on-chain

### Buyer: Purchase & Unlock (One-time)
1. Browse marketplace → click content → chat with AI
2. Connect wallet → click **Buy for X USDC**
3. Click **Unlock Content** → requestAccess → permit sign → unseal → fetch IPFS → decrypt

### Buyer: Subscribe (Time-gated)
1. Click **Subscribe · X USDC / Y days**
2. Subscription expiry stored as FHE-encrypted timestamp — only buyer sees it
3. View active subscriptions at `/subscriptions` (private feed, decrypted client-side)

### Seller: Dashboard
1. View encrypted purchase counts (FHE-decrypted, seller-only)
2. Withdraw USDC earnings

---

## Security & Privacy Model

- **Full content** never sent to any server in plaintext
- **Encrypted content** stored on IPFS — only CID on-chain
- **AES key** stored as FHE ciphertext — unreadable from chain state
- **Purchase history** removed from public mappings — uses event logs only
- **Purchase counts** FHE-encrypted — only seller can decrypt
- **Subscription expiry** FHE-encrypted — only buyer can decrypt
- **Nullifier set** prevents public key reuse
- **AI context** limited to `previewText` — encrypted content never reaches OpenRouter
- **OpenRouter API key** server-side only

---

## Environment Variables

### `packages/hardhat/.env`
```env
PRIVATE_KEY=
ARB_SEPOLIA_RPC_URL=
ARBISCAN_API_KEY=               # Optional, for verification
```

### `packages/nextjs/.env`
```env
OPENROUTER_API_KEY=             # Server-side only
PINATA_JWT=                     # Server-side only
NEXT_PUBLIC_PINATA_GATEWAY=     # e.g. your-gateway.mypinata.cloud
NEXT_PUBLIC_CONTRACT_ADDRESS=0xb30714F68002F901406d68B9648ABb9851F0d318
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## License

MIT
