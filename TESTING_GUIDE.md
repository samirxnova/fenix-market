# Encora — Testing Guide

## Overview

| Layer | Tool | Network |
|-------|------|---------|
| Smart contract unit tests | Hardhat + `@cofhe/hardhat-plugin` mock | Local (in-memory) |
| Frontend manual testing | Browser + MetaMask | Arbitrum Sepolia |
| AI chat | Browser | Arbitrum Sepolia |

---

## Part 1 — Smart Contract Tests

### Setup

```bash
cd packages/hardhat
npm install
```

No `.env` needed for local tests — the mock FHE environment runs in-memory.

### Run Tests

```bash
npm test
```

Expected output:

```
  Encora
    uploadContent
      ✓ stores metadata and emits ContentUploaded
      ✓ reverts if not exactly 8 key chunks
      ✓ increments contentCount
    purchase
      ✓ sets hasPaid and emits ContentPurchased
      ✓ reverts with InsufficientPayment if underpaid
      ✓ reverts on inactive content
      ✓ accumulates sellerBalance
    requestAccess
      ✓ reverts NotPurchased if buyer has not paid
      ✓ grants access and emits AccessGranted
      ✓ returns 8 sealed key chunk handles
      ✓ reverts PubKeyAlreadyUsed on second call with same key
      ✓ buyer can unseal key chunks and recover original values
    withdraw
      ✓ transfers USDC to seller and zeroes balance
      ✓ reverts WithdrawFailed if no balance
    listContents / listByCategory
      ✓ listContents returns all active items with pagination
      ✓ listByCategory filters correctly
      ✓ deactivated content is excluded from listings
      ✓ hasAccess returns false before purchase, true after
```

> The mock FHE environment simulates FHE operations locally. No real encryption happens — plaintext values are stored directly so tests can verify them with `hre.cofhe.mocks.expectPlaintext()`.

---

## Part 2 — Frontend Manual Testing (Arbitrum Sepolia)

### Prerequisites

1. **MetaMask** installed in browser
2. **Arbitrum Sepolia** network in MetaMask:
   - RPC: `https://sepolia-rollup.arbitrum.io/rpc`
   - Chain ID: `421614`
3. **Testnet ETH** for gas — [Arbitrum Sepolia faucet](https://faucet.arbitrum.io)
4. **Testnet USDC** — [Circle faucet](https://faucet.circle.com) → select Arbitrum Sepolia
5. Fill `packages/nextjs/.env`:
   ```
   OPENROUTER_API_KEY=<your key>
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your key>
   NEXT_PUBLIC_CONTRACT_ADDRESS=0x072CbfC304e41F0e73A09721203Ac2059a0Cb03e
   NEXT_PUBLIC_CHAIN_ID=421614
   ```
6. Start frontend:
   ```bash
   cd packages/nextjs && npm run dev
   ```

---

### Flow 1 — Seller: Upload Content

1. Connect wallet on Arbitrum Sepolia
2. Navigate to **Sell** (`/upload`)
3. **Step 1 — Metadata:**
   - Title: `Test Keto Plan`
   - Category: `diet`
   - Price: `1.00` (= 1 USDC)
   - Description: `A test diet plan`
4. **Step 2 — Content:**
   - Preview Text: `This is a 7-day keto meal plan. Low carb, high fat. Covers meal prep, macros, and shopping lists.`
   - Full Content: `# Week 1\n\n## Day 1\n- Breakfast: Eggs and bacon\n- Lunch: Salad`
   - Click **Encrypt & Deploy**
5. Watch encryption progress (4 animated steps)
6. Confirm MetaMask transaction
7. ✅ Redirected to `/dashboard`, content appears in list

---

### Flow 2 — Visitor: AI Chat (no wallet needed)

1. Navigate to **Marketplace** (`/`)
2. Click the uploaded content card
3. In the **AI Chat** widget:
   - Ask: `What does this plan cover?`
   - ✅ AI responds based on preview text only
   - Ask: `What do I eat on Day 5?`
   - ✅ AI says full content covers that and suggests purchasing
4. Send 10 messages — 11th is blocked with "Message limit reached"

---

### Flow 3 — Buyer: Purchase with USDC

> Use a **different wallet** than the seller (or a second MetaMask account). Must have testnet ETH + USDC.

1. Connect buyer wallet
2. Navigate to content detail page
3. Click **Buy for 1.00 USDC**
4. **Tx 1 — Approve USDC:** MetaMask prompts to approve USDC spend → confirm
5. Wait for approval confirmation
6. **Tx 2 — Purchase:** MetaMask prompts for purchase → confirm
7. ✅ Button changes to **Unlock Content**

---

### Flow 4 — Buyer: Unlock Content

1. After purchasing, click **Unlock Content**
2. **Tx 3 — requestAccess:** MetaMask prompts → confirm
3. Wait for transaction confirmation
4. **Permit signing:** MetaMask prompts for EIP-712 signature (free, no gas) → sign
5. cofhejs unseals the 8 FHE key chunks client-side
6. AES key reassembled → content decrypted in browser
7. ✅ Full markdown content appears with green **"Decrypted — visible only to you"** banner
8. ✅ Button changes to **✓ Unlocked**

**Verify privacy:** Open DevTools → Network tab → confirm no request sends decrypted content to any server.

---

### Flow 5 — Seller: Withdraw USDC

1. Switch back to seller wallet
2. Navigate to **Dashboard** (`/dashboard`)
3. Pending Earnings shows `1.00 USDC`
4. Click **Withdraw Funds** → confirm MetaMask
5. ✅ Balance resets to `0.00 USDC`, USDC arrives in seller wallet

---

### Flow 6 — Nullifier Security Test

After completing Flow 4, attempt to call `requestAccess` again with the same public key.

✅ Expected: Transaction reverts with `PubKeyAlreadyUsed`

---

## Part 3 — Edge Cases

| Scenario | Expected |
|----------|----------|
| Purchase with insufficient USDC | MetaMask shows insufficient funds |
| Upload with 0 price | Listed as free — approve(0) still required |
| Deactivate content after purchase | Buyer retains access; hidden from marketplace |
| Wrong network (e.g. Ethereum mainnet) | RainbowKit shows "Wrong network" |
| No `OPENROUTER_API_KEY` | AI chat shows error message |
| Private key with `0x` prefix in `.env` | Hardhat strips it automatically |

---

## Part 4 — Contract Addresses

| Item | Address |
|------|---------|
| Encora contract | `0x072CbfC304e41F0e73A09721203Ac2059a0Cb03e` |
| USDC (Arb Sepolia) | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` |

---

## Part 5 — Common Issues

**Wallet doesn't open on Unlock Content**
- Check browser console for the error message shown below the button
- Most likely `simulateContract` is reverting — check if you've already called `requestAccess` with this account

**"Active permit not found"**
- cofhejs needs a permit signed before unsealing
- This is now handled automatically — wallet will prompt for EIP-712 signature after the requestAccess tx

**"max fee per gas less than block base fee"**
- Gas fees are now fetched live from the chain before every tx — this should not occur
- If it does, retry — base fee fluctuates

**"Transaction reverted" on purchase**
- Check USDC balance: need at least `price` USDC + ETH for gas
- The approve step must complete before purchase

**AI chat returns 500**
- Verify `OPENROUTER_API_KEY` is set in `.env`
- Restart dev server after changing `.env`

**Content not found on detail page**
- Verify `NEXT_PUBLIC_CONTRACT_ADDRESS` matches the deployed address above
