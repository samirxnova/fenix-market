"use client";

import { useCallback } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { ENCORA_ABI, ERC20_ABI, CONTRACT_ADDRESS, USDC_ADDRESS, ContentInfo } from "@/src/contracts/encora";
import { generateSymKey, encryptText, decryptText, exportKey, importKey, keyToUint32Chunks, uint32ChunksToKey } from "@/utils/crypto";
import { encryptKeyChunks } from "@/utils/fheEncrypt";
import { unsealKeyChunks } from "@/utils/unseal";
import { getGasFees } from "@/utils/gas";
import { getCofheClient } from "@/services/cofhe-client";

export function useEncora() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  // ── READ ──────────────────────────────────────────────

  const getContent = useCallback(async (id: bigint): Promise<ContentInfo> => {
    const data = await publicClient!.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "getContent", args: [id],
    });
    return data as ContentInfo;
  }, [publicClient]);

  const listContents = useCallback(async (offset = 0n, limit = 20n): Promise<ContentInfo[]> => {
    const data = await publicClient!.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "listContents", args: [offset, limit],
    });
    return data as ContentInfo[];
  }, [publicClient]);

  const listByCategory = useCallback(async (category: string, offset = 0n, limit = 20n): Promise<ContentInfo[]> => {
    const data = await publicClient!.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "listByCategory", args: [category, offset, limit],
    });
    return data as ContentInfo[];
  }, [publicClient]);

  const getMyUploads = useCallback(async (): Promise<bigint[]> => {
    if (!address) return [];
    const data = await publicClient!.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "getContentsBySeller", args: [address],
    });
    return data as bigint[];
  }, [publicClient, address]);

  const getMyPurchases = useCallback(async (): Promise<bigint[]> => {
    if (!address || !publicClient) return [];
    // EncoraV2 removed purchasesByBuyer for privacy — use event logs instead
    const logs = await publicClient.getContractEvents({
      address: CONTRACT_ADDRESS,
      abi: ENCORA_ABI,
      eventName: "ContentPurchased",
      args: { buyer: address },
      fromBlock: 0n,
    });
    return logs.map(log => (log.args as { id: bigint }).id);
  }, [publicClient, address]);

  const checkAccess = useCallback(async (contentId: bigint): Promise<boolean> => {
    if (!address) return false;
    return publicClient!.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "hasAccess", args: [contentId, address],
    }) as Promise<boolean>;
  }, [publicClient, address]);

  const getSellerBalance = useCallback(async (): Promise<bigint> => {
    if (!address) return 0n;
    return publicClient!.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "sellerBalance", args: [address],
    }) as Promise<bigint>;
  }, [publicClient, address]);

  // ── WRITE ─────────────────────────────────────────────

  /** Full upload pipeline */
  const uploadContent = useCallback(async (params: {
    title: string;
    description: string;
    previewText: string;
    fullContent: string;
    category: string;
    priceEth: string;
    subscriptionDuration?: number; // 0 = one-time, >0 = seconds
  }) => {
    if (!walletClient || !address) throw new Error("Wallet not connected");

    // 1. AES-encrypt the full text
    const symKey = await generateSymKey();
    const encryptedContent = await encryptText(params.fullContent, symKey);

    // 2. Upload encrypted bytes to Pinata IPFS
    const blob = new Blob([new Uint8Array(encryptedContent) as BlobPart]);
    const file = new File([blob], `encora-${Date.now()}.enc`, { type: "application/octet-stream" });
    const urlRes = await fetch("/api/upload-url");
    const { url: presignedUrl } = await urlRes.json();
    const { PinataSDK } = await import("pinata");
    const pinataSdk = new PinataSDK({ pinataJwt: "", pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY || "" });
    const ipfsUpload = await pinataSdk.upload.public.file(file).url(presignedUrl);
    const encryptedContentCID = ipfsUpload.cid;

    // 3. FHE-encrypt the AES key
    const keyBytes = await exportKey(symKey);
    const chunks = keyToUint32Chunks(keyBytes);
    const encChunks = await encryptKeyChunks(chunks);

    // 4. Store CID on-chain (not the full encrypted bytes)
    const gas = await getGasFees(publicClient!);
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ENCORA_ABI,
      functionName: "uploadContent",
      args: [
        params.title,
        params.description,
        params.previewText,
        encryptedContentCID,
        encChunks as never,
        params.category,
        parseUnits(params.priceEth, 6),
        BigInt(params.subscriptionDuration || 0),
      ],
      ...gas,
    });

    return hash;
  }, [walletClient, address]);

  /** Approve USDC spend then purchase content */
  const purchaseContent = useCallback(async (contentId: bigint, price: bigint) => {
    if (!walletClient || !address) throw new Error("Wallet not connected");

    const gas = await getGasFees(publicClient!);

    const allowance = await publicClient!.readContract({
      address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance",
      args: [address, CONTRACT_ADDRESS],
    }) as bigint;

    if (allowance < price) {
      const approveTx = await walletClient.writeContract({
        address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve",
        args: [CONTRACT_ADDRESS, price],
        ...gas,
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveTx });
    }

    return walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "purchase",
      args: [contentId],
      ...gas,
    });
  }, [walletClient, publicClient, address]);

  const requestAndDecrypt = useCallback(async (content: ContentInfo): Promise<string> => {
    if (!walletClient || !address) throw new Error("Wallet not connected");

    const gas = await getGasFees(publicClient!);

    // Use random pubKey bytes each time to avoid PubKeyAlreadyUsed nullifier collision
    const randBytes = () => {
      const b = new Uint8Array(32);
      crypto.getRandomValues(b);
      return ("0x" + Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
    };
    const pubKeyX = randBytes();
    const pubKeyY = randBytes();

    // simulateContract to get the sealed euint32 handles (return value)
    let sealedHandles: readonly bigint[];
    try {
      const { result } = await publicClient!.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: ENCORA_ABI,
        functionName: "requestAccess",
        args: [content.id, pubKeyX, pubKeyY],
        account: address,
        ...gas,
      });
      sealedHandles = (result as unknown) as readonly bigint[];
    } catch (err) {
      console.error("simulateContract failed:", err);
      throw err;
    }

    // Send the actual transaction
    const txHash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "requestAccess",
      args: [content.id, pubKeyX, pubKeyY],
      ...gas,
    });
    await publicClient!.waitForTransactionReceipt({ hash: txHash });

    // Ensure a cofhejs permit exists and is not expired
    const client = getCofheClient();
    const chainId = await publicClient!.getChainId();
    let needsNewPermit = false;
    try {
      const existingPermit = client.permits.getActivePermit(chainId, address);
      if (!existingPermit) {
        needsNewPermit = true;
      } else {
        const exp = (existingPermit as { expiration?: number }).expiration;
        if (exp && exp < Math.floor(Date.now() / 1000)) {
          needsNewPermit = true;
        }
      }
    } catch {
      needsNewPermit = true;
    }
    if (needsNewPermit) {
      await client.permits.createSelf({ issuer: address, name: "Encora" });
    }

    const plainChunks = await unsealKeyChunks([...sealedHandles]);
    const keyBytes = uint32ChunksToKey(plainChunks);
    const symKey = await importKey(keyBytes);

    // Fetch encrypted content from Pinata IPFS gateway
    const gatewayUrl = `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY}/ipfs/${content.encryptedContentCID}`;
    const encRes = await fetch(gatewayUrl);
    const encBlob = await encRes.arrayBuffer();
    return decryptText(new Uint8Array(encBlob), symKey);
  }, [walletClient, publicClient, address]);

  const withdraw = useCallback(async () => {
    if (!walletClient) throw new Error("Wallet not connected");
    const gas = await getGasFees(publicClient!);
    return walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "withdraw", args: [],
      ...gas,
    });
  }, [walletClient, publicClient]);

  /** Subscribe to content (time-gated, FHE-encrypted expiry) */
  const subscribeContent = useCallback(async (contentId: bigint, price: bigint) => {
    if (!walletClient || !address) throw new Error("Wallet not connected");
    const gas = await getGasFees(publicClient!);
    const allowance = await publicClient!.readContract({
      address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance",
      args: [address, CONTRACT_ADDRESS],
    }) as bigint;
    if (allowance < price) {
      const approveTx = await walletClient.writeContract({
        address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve",
        args: [CONTRACT_ADDRESS, price], ...gas,
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveTx });
    }
    return walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "subscribe",
      args: [contentId], ...gas,
    });
  }, [walletClient, publicClient, address]);

  /** Renew subscription */
  const renewSubscription = useCallback(async (contentId: bigint, price: bigint) => {
    if (!walletClient || !address) throw new Error("Wallet not connected");
    const gas = await getGasFees(publicClient!);
    const allowance = await publicClient!.readContract({
      address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "allowance",
      args: [address, CONTRACT_ADDRESS],
    }) as bigint;
    if (allowance < price) {
      const approveTx = await walletClient.writeContract({
        address: USDC_ADDRESS, abi: ERC20_ABI, functionName: "approve",
        args: [CONTRACT_ADDRESS, price], ...gas,
      });
      await publicClient!.waitForTransactionReceipt({ hash: approveTx });
    }
    return walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "renewSubscription",
      args: [contentId], ...gas,
    });
  }, [walletClient, publicClient, address]);

  /** Get encrypted subscription expiries — buyer unseals client-side */
  const getMySubscriptions = useCallback(async (contentIds: bigint[]): Promise<bigint[]> => {
    if (!address || !publicClient) return [];
    const handles = await publicClient.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "getMySubscriptions",
      args: [contentIds],
    }) as unknown as bigint[];
    return handles;
  }, [publicClient, address]);

  /** Get FHE-encrypted purchase counts for seller's content. */
  const getMyAnalytics = useCallback(async (contentIds: bigint[]): Promise<bigint[]> => {
    if (!address || !publicClient) return [];
    const handles = await publicClient.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "getMyAnalytics",
      args: [contentIds],
    }) as unknown as bigint[];
    return handles;
  }, [publicClient, address]);

  return {
    getContent, listContents, listByCategory, getMyUploads, getMyPurchases,
    checkAccess, getSellerBalance, uploadContent, purchaseContent, requestAndDecrypt, withdraw,
    getMyAnalytics, subscribeContent, renewSubscription, getMySubscriptions,
  };
}
