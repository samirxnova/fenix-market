# Encora

**Privacy-preserving knowledge marketplace powered by Fully Homomorphic Encryption (FHE)**

Sellers upload text/markdown content — diet plans, skill guides, trading strategies, tutorials — protected by two-layer encryption. Buyers pay in USDC and decrypt content entirely client-side. Not even the marketplace can read it.

---

## How It Works

```
Seller                    Encora Contract (Arb Sepolia)        Buyer
  │                                │                              │
  │── uploadContent(               │                              │
  │     previewText,               │                              │
  │     AES(fullText),             │                              │
  │     FHE(aesKey)) ─────────────►│                              │
  │                                │  previewText → AI chat ─────►│
  │                                │◄─ purchase (USDC) ───────────│
  │                                │◄─ requestAccess(pubKey) ─────│
  │                                │  FHE.allow(keyChunks, buyer) │
  │                                │── sealedKeyChunks ──────────►│
  │                                │  unseal → AES key            │
  │                                │  decrypt fullText locally    │
```

### Two-Layer Encryption

**Layer 1 — AES-GCM (browser, off-chain):**
Seller encrypts the full text with a random 256-bit AES key in the browser. The ciphertext is stored on-chain as public bytes — unreadable without the key.

**Layer 2 — FHE (on-chain, Fhenix CoFHE):**
The AES key is split into 8 × `euint32` chunks and stored as FHE ciphertext. When a buyer pays and provides their sealing public key, the contract calls `FHE.allow(chunk, buyer)` for each chunk. The buyer unseals them client-side via `cofhejs`, reassembles the AES key, and decrypts the content locally.

**AI Chat:**
The seller writes a `previewText` (never shown publicly). It's used as context for an OpenRouter-powered AI chat widget — any visitor can ask questions about the content before buying.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart contract | Solidity 0.8.25, Fhenix CoFHE (`@fhenixprotocol/cofhe-contracts`) |
| FHE client | `@cofhe/sdk` 0.5.1 |
| Frontend | Next.js 14, Tailwind CSS, wagmi v2, RainbowKit |
| Payment | USDC ERC-20 (Arbitrum Sepolia) |
| AI chat | OpenRouter (OpenAI-compatible, `gpt-4o-mini`) |
| Network | Arbitrum Sepolia (testnet) |

---

## Contract

| Item | Value |
|------|-------|
| Encora contract | `0x072CbfC304e41F0e73A09721203Ac2059a0Cb03e` |
| USDC (Arb Sepolia) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |
| Network | Arbitrum Sepolia (Chain ID: 421614) |

---

## Project Structure

```
encora/
├── packages/
│   ├── hardhat/                  # Smart contract
│   │   ├── contracts/
│   │   │   └── Encora.sol        # Main contract
│   │   ├── test/
│   │   │   └── Encora.test.ts    # 18 unit tests
│   │   ├── deploy/
│   │   │   └── 001_deploy_encora.ts
│   │   └── hardhat.config.ts
│   └── nextjs/                   # Frontend
│       ├── app/
│       │   ├── page.tsx          # Marketplace
│       │   ├── upload/           # Seller upload (3-step wizard)
│       │   ├── content/[id]/     # Content detail + AI chat + unlock
│       │   ├── dashboard/        # Seller dashboard + withdraw
│       │   ├── purchases/        # Buyer purchases
│       │   └── api/chat/         # OpenRouter AI proxy (edge)
│       ├── components/           # UI components
│       ├── hooks/
│       │   ├── useEncora.ts      # Contract interactions
│       │   ├── useCofhe.ts       # FHE client init
│       │   └── usePreviewChat.ts # AI chat streaming
│       └── utils/
│           ├── crypto.ts         # AES-GCM encrypt/decrypt
│           ├── fheEncrypt.ts     # FHE key chunk encryption
│           ├── unseal.ts         # FHE unsealing with permit
│           └── gas.ts            # Live EIP-1559 gas fees
├── plan.md
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

### Install

```bash
# Install all packages
cd packages/hardhat && npm install
cd ../nextjs && npm install
```

### Run Contract Tests

```bash
cd packages/hardhat
npm test
```

### Run Frontend

```bash
# 1. Configure environment
cp packages/nextjs/.env.example packages/nextjs/.env
# Fill in:
#   OPENROUTER_API_KEY=
#   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
#   NEXT_PUBLIC_CONTRACT_ADDRESS=0x072CbfC304e41F0e73A09721203Ac2059a0Cb03e
#   NEXT_PUBLIC_CHAIN_ID=421614

# 2. Start dev server
cd packages/nextjs
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Deploy Contract (optional — already deployed)

```bash
cd packages/hardhat
cp .env.example .env
# Fill in PRIVATE_KEY and ARB_SEPOLIA_RPC_URL
npm run deploy -- --network arb-sepolia
```

---

## User Flows

### Seller: Upload Content
1. Connect wallet → navigate to **Sell**
2. Fill metadata (title, category, price in USDC, description)
3. Write preview text (used by AI — never shown publicly)
4. Write full content in markdown
5. Click **Encrypt & Deploy** → browser AES-encrypts content → FHE-encrypts AES key → submits to contract

### Buyer: Purchase & Unlock
1. Browse marketplace → click content
2. Chat with AI about the content (no wallet needed)
3. Connect wallet → click **Buy for X USDC**
   - Tx 1: Approve USDC spend
   - Tx 2: Purchase
4. Click **Unlock Content**
   - Tx 3: `requestAccess` (grants FHE access to key chunks)
   - Sign EIP-712 permit (free, no gas)
   - cofhejs unseals key chunks client-side
   - AES key reassembled → content decrypted in browser
   - Full markdown content displayed

### Seller: Withdraw
1. Navigate to **Dashboard**
2. Click **Withdraw Funds** → USDC transferred to wallet

---

## Security Model

- **Full content** is never sent to any server in plaintext
- **AES key** is stored as FHE ciphertext — unreadable from chain state
- **Nullifier set** prevents a buyer from reusing the same public key to get multiple decryptions
- **`FHE.allowThis`** on all key chunks — contract retains access to grant future buyers
- **No `FHE.allowPublic`** on key chunks — they can never be publicly decrypted
- **OpenRouter API key** is server-side only — never exposed to the browser
- **AI context** is limited to `previewText` — the encrypted content is never sent to OpenRouter

---

## Environment Variables

### `packages/hardhat/.env`
```env
PRIVATE_KEY=                    # Deployer private key (without 0x prefix issues — strip if needed)
ARB_SEPOLIA_RPC_URL=            # Arbitrum Sepolia RPC
BASE_SEPOLIA_RPC_URL=           # Base Sepolia RPC (optional)
ARBISCAN_API_KEY=               # For contract verification (optional)
```

### `packages/nextjs/.env`
```env
OPENROUTER_API_KEY=             # Server-side only — never prefix with NEXT_PUBLIC_
NEXT_PUBLIC_CONTRACT_ADDRESS=0x072CbfC304e41F0e73A09721203Ac2059a0Cb03e
NEXT_PUBLIC_CHAIN_ID=421614
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## License

MIT
