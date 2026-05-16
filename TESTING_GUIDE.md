# Encora — Testing Guide

## Contract Addresses

| Item | Address |
|------|---------|
| EncoraV3 (latest) | `0xb30714F68002F901406d68B9648ABb9851F0d318` |
| USDC (Arb Sepolia) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |

---

## Prerequisites

1. MetaMask with Arbitrum Sepolia (RPC: `https://sepolia-rollup.arbitrum.io/rpc`, Chain ID: `421614`)
2. Testnet ETH — [Arbitrum faucet](https://faucet.arbitrum.io)
3. Testnet USDC — [Circle faucet](https://faucet.circle.com) → Arbitrum Sepolia
4. Fill `packages/nextjs/.env`:
   ```
   OPENROUTER_API_KEY=<key>
   PINATA_JWT=<key>
   NEXT_PUBLIC_PINATA_GATEWAY=<your-gateway>.mypinata.cloud
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<key>
   NEXT_PUBLIC_CONTRACT_ADDRESS=0xb30714F68002F901406d68B9648ABb9851F0d318
   NEXT_PUBLIC_CHAIN_ID=421614
   ```
5. Start: `cd packages/nextjs && npm run dev`

---

## Flow 1 — Seller: Upload One-Time Content

1. Connect wallet → **Sell**
2. Title: `Test Keto Plan`, Category: `diet`, Price: `1.00`
3. Leave subscription toggle **OFF**
4. Preview: `7-day keto plan. Low carb, high fat.`
5. Full content: write or drag-drop a `.md` file
6. **Encrypt & Deploy** → confirm MetaMask
7. ✅ Redirected to dashboard, content listed

---

## Flow 2 — Seller: Upload Subscription Content

1. Connect wallet → **Sell**
2. Title: `Weekly Trading Signals`, Category: `finance`, Price: `2.00`
3. Toggle **Subscription pricing** ON → select **30 days**
4. Preview + full content as above
5. **Encrypt & Deploy** → confirm
6. ✅ Content shows "2.00 USDC / 30 days" on marketplace

---

## Flow 3 — AI Chat (no wallet needed)

1. Click any content → AI chat widget
2. Ask: `What does this cover?` → AI answers from preview
3. Ask: `Give me the full plan` → AI suggests purchasing
4. 10 messages max per session

---

## Flow 4 — Buyer: One-Time Purchase

1. Different wallet with USDC + ETH
2. Click one-time content → **Buy for X USDC**
3. Tx 1: Approve USDC → Tx 2: Purchase
4. ✅ Button changes to **Unlock Content**

---

## Flow 5 — Buyer: Subscribe

1. Click subscription content → **Subscribe · 2.00 USDC / 30d**
2. Tx 1: Approve USDC → Tx 2: Subscribe
3. ✅ Button changes to **Unlock Content**
4. Navigate to `/subscriptions` → see your private feed with expiry date

---

## Flow 6 — Buyer: Unlock Content

1. Click **Unlock Content**
2. Tx: `requestAccess` → confirm
3. Permit sign (EIP-712, free)
4. cofhejs unseals key chunks → fetches from IPFS → AES decrypts
5. ✅ Full markdown displayed with green "Decrypted" banner

---

## Flow 7 — Buyer: Private Subscription Feed

1. Navigate to `/subscriptions`
2. ✅ Shows active subscriptions with expiry dates
3. ✅ All data decrypted client-side — FHE badge confirms privacy
4. Expired subscriptions show in red

---

## Flow 8 — Seller: Dashboard + FHE Analytics

1. Seller wallet → **Dashboard**
2. ✅ Pending earnings shown
3. ✅ Per-content "X sales" badge (FHE-decrypted, seller-only)
4. **Withdraw Funds** → USDC transferred

---

## Flow 9 — Drag & Drop Upload

1. Go to **Sell** → Step 2
2. Drag a `.md` or `.txt` file onto the drop zone
3. ✅ Content populates the editor, title auto-fills from filename

---

## Edge Cases

| Scenario | Expected |
|----------|----------|
| Purchase subscription content with `purchase()` | Reverts `IsSubscriptionContent` |
| Subscribe to one-time content | Reverts `NotSubscriptionContent` |
| Insufficient USDC | MetaMask shows error |
| Same pubKey twice | Reverts `PubKeyAlreadyUsed` |
| Expired permit | Auto-recreates on next unlock |
| No OPENROUTER_API_KEY | Chat returns 500 |
| No PINATA_JWT | Upload fails at IPFS step |

---

## Common Issues

**Wallet button disappears (localhost only)**
- MetaMask's SES lockdown breaks React hydration in dev mode
- Works fine in production (Vercel) and incognito mode

**"Permit is expired"**
- Handled automatically — will prompt for new EIP-712 signature

**"max fee per gas less than block base fee"**
- Gas fees fetched live before every tx — retry if base fee spiked

**Purchases page empty**
- Uses event logs (privacy feature) — only shows content you purchased on current contract
