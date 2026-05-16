# Phala TEE AI Integration Plan

**Goal:** Replace OpenRouter with Phala Confidential AI running in a TEE. Encrypt the AI preview text on-chain (same as full content), and only the TEE AI can decrypt it to answer buyer questions. The preview is never stored in plaintext anywhere — not on-chain, not on any server.

---

## Current Architecture (OpenRouter)

```
Buyer asks question
  → Next.js API route (server-side)
    → sends previewText (plaintext) + question to OpenRouter
    → streams response back
```

**Problem:** The `previewText` is stored as plaintext on-chain and passed to OpenRouter in cleartext. Anyone can read it from chain state. OpenRouter sees the full preview.

---

## New Architecture (Phala TEE AI)

```
Seller uploads:
  - encryptedPreview (AES-encrypted preview, stored on-chain as bytes)
  - FHE-encrypted AES key for preview (separate from content key)

Buyer asks question:
  → Next.js API route
    → sends encryptedPreview + question to Phala TEE AI service
    → TEE decrypts preview using its private key
    → TEE runs LLM inference on decrypted preview + question
    → TEE returns answer (plaintext answer only — preview never leaves TEE)
    → streams response back to buyer
```

**Key insight:** The TEE has a keypair. The seller encrypts the preview with the TEE's public key. Only the TEE can decrypt it. The LLM runs inside the TEE. The preview never exists in plaintext outside the TEE enclave.

---

## Phala Infrastructure Used

### Option A: Confidential AI API (Simplest — recommended for MVP)

Use Phala's pre-deployed models at `https://api.redpill.ai/v1` with a custom CVM sidecar for decryption.

- **Endpoint:** `https://api.redpill.ai/v1/chat/completions`
- **Models:** `phala/qwen3.5-27b` (27B, 262K context, $0.30/$2.40 per 1M tokens) or `phala/gpt-oss-20b` (cheapest, $0.04/$0.15)
- **Streaming:** Supported (OpenAI-compatible SSE)
- **Attestation:** Verifiable via `/v1/signature` endpoint
- **Billing:** Pay per request, minimum $5 deposit

### Option B: Custom CVM (Full control)

Deploy a custom Confidential VM on Phala Cloud that:
1. Holds the decryption private key (injected as encrypted env var — only TEE can read)
2. Receives encrypted preview + question
3. Decrypts preview inside TEE
4. Calls LLM (either self-hosted in same CVM, or Phala Confidential AI API)
5. Returns answer

- **Instance:** `tdx.medium` (4 vCPU, 8GB RAM) — $0.12/hr
- **Deploy:** Docker Compose via `phala deploy` CLI
- **Secrets:** Encrypted env vars (X25519 + AES-256-GCM, decrypted only inside TEE at boot)
- **Attestation:** Hardware attestation proves code integrity

---

## Detailed Design

### 1. Key Management

```
TEE Service generates a keypair at first boot:
  - Private key: stored only in TEE memory (or encrypted env var)
  - Public key: published on-chain or via API endpoint

Seller encrypts preview:
  - AES-GCM encrypt previewText with random key
  - Encrypt the AES key with TEE's public key (X25519/ECIES)
  - Store both on-chain: encryptedPreview + encryptedPreviewKey
```

### 2. Smart Contract Changes

```solidity
struct Content {
    // ... existing fields ...
    bytes encryptedPreview;      // AES-encrypted preview text
    bytes encryptedPreviewKey;   // Preview AES key encrypted with TEE public key
    // Remove: string previewText (no longer stored in plaintext)
}
```

The `previewText` field becomes `encryptedPreview` + `encryptedPreviewKey`. No plaintext preview on-chain.

### 3. TEE AI Service (Custom CVM on Phala Cloud)

**Docker Compose:**
```yaml
services:
  tee-ai:
    image: encora/tee-ai-service:latest
    ports:
      - "443:3000"
    environment:
      - TEE_PRIVATE_KEY=${TEE_PRIVATE_KEY}
      - PHALA_AI_API_KEY=${PHALA_AI_API_KEY}
```

**Service logic (Node.js inside TEE):**
```typescript
// POST /api/chat
// Body: { encryptedPreview, encryptedPreviewKey, messages }

app.post("/api/chat", async (req, res) => {
  const { encryptedPreview, encryptedPreviewKey, messages } = req.body;

  // 1. Decrypt the preview AES key using TEE's private key
  const previewAesKey = eciesDecrypt(TEE_PRIVATE_KEY, encryptedPreviewKey);

  // 2. Decrypt the preview text
  const previewText = aesDecrypt(encryptedPreview, previewAesKey);

  // 3. Call Phala Confidential AI with decrypted preview as context
  const response = await fetch("https://api.redpill.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PHALA_AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "phala/qwen3.5-27b",
      messages: [
        { role: "system", content: `Answer based on this content:\n\n${previewText}` },
        ...messages,
      ],
      stream: true,
    }),
  });

  // 4. Stream response back (preview never leaves TEE)
  res.setHeader("Content-Type", "text/event-stream");
  response.body.pipe(res);
});
```

### 4. Frontend Changes

**Upload flow (seller):**
```typescript
// 1. Fetch TEE public key from the TEE service
const teePublicKey = await fetch("https://encora-tee.phala.cloud/pubkey").then(r => r.text());

// 2. Encrypt preview with random AES key
const previewKey = await generateSymKey();
const encryptedPreview = await encryptText(previewText, previewKey);

// 3. Encrypt the preview AES key with TEE's public key
const encryptedPreviewKey = eciesEncrypt(teePublicKey, await exportKey(previewKey));

// 4. Upload to contract (no plaintext preview)
contract.uploadContent(title, desc, encryptedPreview, encryptedPreviewKey, encryptedContent, ...)
```

**Chat flow (buyer):**
```typescript
// POST to TEE service instead of /api/chat
const res = await fetch("https://encora-tee.phala.cloud/api/chat", {
  method: "POST",
  body: JSON.stringify({
    encryptedPreview: content.encryptedPreview,    // from chain
    encryptedPreviewKey: content.encryptedPreviewKey, // from chain
    messages: [...userMessages],
  }),
});
// Stream SSE response as before
```

### 5. Attestation Verification

Before trusting the TEE service, the frontend can verify:

```typescript
// Fetch attestation report
const attestation = await fetch("https://encora-tee.phala.cloud/attestation").then(r => r.json());

// Verify the TEE is genuine and running expected code
// Uses Phala's attestation verification SDK
const isValid = await verifyAttestation(attestation);
```

This proves:
- The service runs in genuine Intel TDX hardware
- The code hasn't been tampered with
- The private key is only accessible inside the TEE

---

## Security Model Comparison

| Property | Current (OpenRouter) | New (Phala TEE) |
|----------|---------------------|-----------------|
| Preview stored on-chain | Plaintext | Encrypted |
| AI provider sees preview | Yes (OpenRouter) | No (decrypted only inside TEE) |
| Server operator sees preview | Yes (our API route) | No (TEE enclave) |
| Verifiable execution | No | Yes (attestation) |
| Preview readable from chain | Anyone | Nobody |

---

## Implementation Phases

### Phase A — Phala Confidential AI API (Quick win, 1 day)

Replace OpenRouter with Phala's `api.redpill.ai` in the existing API route. Same architecture, but inference runs in TEE. Preview is still plaintext on-chain but AI inference is confidential.

**Changes:**
- `app/api/chat/route.ts`: Change base URL from `openrouter.ai` to `api.redpill.ai`
- `.env`: Replace `OPENROUTER_API_KEY` with `PHALA_AI_API_KEY`
- Model: `phala/qwen3.5-27b` or `phala/gpt-oss-20b`

### Phase B — Encrypted Preview + TEE Decryption (Full privacy, 1 week)

1. Deploy custom CVM on Phala Cloud with decryption service
2. Update contract: replace `previewText` with `encryptedPreview` + `encryptedPreviewKey`
3. Update upload flow: encrypt preview with TEE public key
4. Update chat flow: send encrypted data to TEE service
5. Add attestation verification in frontend

### Phase C — On-chain TEE Public Key Registry (Trustless, 2 days)

Store the TEE's public key on-chain with its attestation hash. Smart contract verifies the key is bound to a valid TEE before accepting uploads. This makes the system fully trustless — no need to trust a URL.

---

## Costs

| Component | Cost |
|-----------|------|
| Phala Confidential AI API | ~$0.04–$0.30 per 1M input tokens |
| Custom CVM (tdx.medium) | ~$0.12/hr (~$86/month) |
| Attestation verification | Free (on-chain check) |

---

## Files to Create/Modify

```
packages/
  tee-service/                    # New: Phala CVM service
    Dockerfile
    docker-compose.yml
    src/index.ts                  # Decrypt + proxy to Phala AI
    src/crypto.ts                 # ECIES decrypt, AES decrypt
  hardhat/
    contracts/Encora.sol          # Add encryptedPreview, encryptedPreviewKey fields
  nextjs/
    app/api/chat/route.ts         # Point to TEE service instead of OpenRouter
    hooks/useEncora.ts            # Upload: encrypt preview with TEE pubkey
    utils/ecies.ts                # New: ECIES encrypt with TEE public key
```
