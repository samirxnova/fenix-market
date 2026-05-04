"use client";

import { useCallback } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import { parseUnits, toHex, hexToBytes } from "viem";
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
    if (!address) return [];
    const data = await publicClient!.readContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "getPurchasesByBuyer", args: [address],
    });
    return data as bigint[];
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

  /** Full upload pipeline: encrypt text → FHE-encrypt key → submit tx
   *  priceUsdc: price in USDC (e.g. "5.00" = 5 USDC = 5_000000 units) */
  const uploadContent = useCallback(async (params: {
    title: string;
    description: string;
    previewText: string;
    fullContent: string;
    category: string;
    priceEth: string; // field name kept for compat — value is treated as USDC amount
  }) => {
    if (!walletClient || !address) throw new Error("Wallet not connected");

    const symKey = await generateSymKey();
    const encryptedContent = await encryptText(params.fullContent, symKey);
    const keyBytes = await exportKey(symKey);
    const chunks = keyToUint32Chunks(keyBytes);
    const encChunks = await encryptKeyChunks(chunks);

    const gas = await getGasFees(publicClient!);
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS,
      abi: ENCORA_ABI,
      functionName: "uploadContent",
      args: [
        params.title,
        params.description,
        params.previewText,
        toHex(encryptedContent),
        encChunks as never,
        params.category,
        parseUnits(params.priceEth, 6),
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
      sealedHandles = result as readonly bigint[];
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

    // Ensure a cofhejs permit exists — required for decryptForView
    const client = getCofheClient();
    const chainId = await publicClient!.getChainId();
    const existingPermit = client.permits.getActivePermit(chainId, address);
    if (!existingPermit) {
      await client.permits.createSelf({ issuer: address, name: "Encora" });
    }

    const plainChunks = await unsealKeyChunks([...sealedHandles]);
    const keyBytes = uint32ChunksToKey(plainChunks);
    const symKey = await importKey(keyBytes);
    const encBytes = hexToBytes(content.encryptedContent);
    return decryptText(encBytes, symKey);
  }, [walletClient, publicClient, address]);

  const withdraw = useCallback(async () => {
    if (!walletClient) throw new Error("Wallet not connected");
    const gas = await getGasFees(publicClient!);
    return walletClient.writeContract({
      address: CONTRACT_ADDRESS, abi: ENCORA_ABI, functionName: "withdraw", args: [],
      ...gas,
    });
  }, [walletClient, publicClient]);

  return {
    getContent, listContents, listByCategory, getMyUploads, getMyPurchases,
    checkAccess, getSellerBalance, uploadContent, purchaseContent, requestAndDecrypt, withdraw,
  };
}
