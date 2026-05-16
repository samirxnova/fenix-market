export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000"
) as `0x${string}`;

// USDC on Arbitrum Sepolia
export const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as `0x${string}`;

// Minimal ERC-20 ABI for approve + allowance
export const ERC20_ABI = [
  {
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export interface ContentInfo {
  id: bigint;
  seller: `0x${string}`;
  title: string;
  description: string;
  previewText: string;
  encryptedContentCID: string;
  price: bigint;
  subscriptionDuration: bigint;
  active: boolean;
  createdAt: bigint;
  category: string;
  keyChunks: bigint;
}

// InEuint32 tuple type (matches Solidity struct)
export const IN_EUINT32_COMPONENTS = [
  { internalType: "uint256", name: "ctHash", type: "uint256" },
  { internalType: "uint8", name: "securityZone", type: "uint8" },
  { internalType: "uint8", name: "utype", type: "uint8" },
  { internalType: "bytes", name: "signature", type: "bytes" },
] as const;

export const ENCORA_ABI = [
  // Errors
  { inputs: [], name: "ContentNotFound", type: "error" },
  { inputs: [], name: "ContentNotActive", type: "error" },
  { inputs: [], name: "InsufficientPayment", type: "error" },
  { inputs: [], name: "NotPurchased", type: "error" },
  { inputs: [], name: "PubKeyAlreadyUsed", type: "error" },
  { inputs: [], name: "NotSeller", type: "error" },
  { inputs: [], name: "WithdrawFailed", type: "error" },
  { inputs: [], name: "InvalidKeyChunks", type: "error" },

  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      { indexed: true, internalType: "address", name: "seller", type: "address" },
      { indexed: false, internalType: "string", name: "title", type: "string" },
      { indexed: false, internalType: "string", name: "category", type: "string" },
    ],
    name: "ContentUploaded",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
    ],
    name: "ContentPurchased",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "id", type: "uint256" },
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
    ],
    name: "AccessGranted",
    type: "event",
  },

  // Write functions
  {
    inputs: [
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "description", type: "string" },
      { internalType: "string", name: "previewText", type: "string" },
      { internalType: "string", name: "encryptedContentCID", type: "string" },
      { components: IN_EUINT32_COMPONENTS, internalType: "struct InEuint32[]", name: "encSymKeyChunks", type: "tuple[]" },
      { internalType: "string", name: "category", type: "string" },
      { internalType: "uint256", name: "price", type: "uint256" },
      { internalType: "uint256", name: "subscriptionDuration", type: "uint256" },
    ],
    name: "uploadContent",
    outputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "contentId", type: "uint256" }],
    name: "purchase",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "contentId", type: "uint256" }],
    name: "subscribe",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "contentId", type: "uint256" }],
    name: "renewSubscription",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256[]", name: "contentIds", type: "uint256[]" }],
    name: "getMySubscriptions",
    outputs: [{ internalType: "euint64[]", name: "expiries", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "USDC",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "contentId", type: "uint256" },
      { internalType: "bytes32", name: "buyerPubKeyX", type: "bytes32" },
      { internalType: "bytes32", name: "buyerPubKeyY", type: "bytes32" },
    ],
    name: "requestAccess",
    outputs: [{ internalType: "euint32[]", name: "sealed", type: "bytes32[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "contentId", type: "uint256" }],
    name: "deactivate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // View functions
  {
    inputs: [],
    name: "contentCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "id", type: "uint256" }],
    name: "getContent",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "address", name: "seller", type: "address" },
          { internalType: "string", name: "title", type: "string" },
          { internalType: "string", name: "description", type: "string" },
          { internalType: "string", name: "previewText", type: "string" },
          { internalType: "string", name: "encryptedContentCID", type: "string" },
          { internalType: "uint256", name: "price", type: "uint256" },
          { internalType: "bool", name: "active", type: "bool" },
          { internalType: "uint256", name: "createdAt", type: "uint256" },
          { internalType: "string", name: "category", type: "string" },
          { internalType: "uint256", name: "keyChunks", type: "uint256" },
        ],
        internalType: "struct Encora.ContentInfo",
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "listContents",
    outputs: [{ components: [{ internalType: "uint256", name: "id", type: "uint256" }, { internalType: "address", name: "seller", type: "address" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "description", type: "string" }, { internalType: "string", name: "previewText", type: "string" }, { internalType: "string", name: "encryptedContentCID", type: "string" }, { internalType: "uint256", name: "price", type: "uint256" }, { internalType: "uint256", name: "subscriptionDuration", type: "uint256" }, { internalType: "bool", name: "active", type: "bool" }, { internalType: "uint256", name: "createdAt", type: "uint256" }, { internalType: "string", name: "category", type: "string" }, { internalType: "uint256", name: "keyChunks", type: "uint256" }], internalType: "struct Encora.ContentInfo[]", name: "", type: "tuple[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "category", type: "string" },
      { internalType: "uint256", name: "offset", type: "uint256" },
      { internalType: "uint256", name: "limit", type: "uint256" },
    ],
    name: "listByCategory",
    outputs: [{ components: [{ internalType: "uint256", name: "id", type: "uint256" }, { internalType: "address", name: "seller", type: "address" }, { internalType: "string", name: "title", type: "string" }, { internalType: "string", name: "description", type: "string" }, { internalType: "string", name: "previewText", type: "string" }, { internalType: "string", name: "encryptedContentCID", type: "string" }, { internalType: "uint256", name: "price", type: "uint256" }, { internalType: "uint256", name: "subscriptionDuration", type: "uint256" }, { internalType: "bool", name: "active", type: "bool" }, { internalType: "uint256", name: "createdAt", type: "uint256" }, { internalType: "string", name: "category", type: "string" }, { internalType: "uint256", name: "keyChunks", type: "uint256" }], internalType: "struct Encora.ContentInfo[]", name: "", type: "tuple[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "seller", type: "address" }],
    name: "getContentsBySeller",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "buyer", type: "address" }],
    name: "getPurchasesByBuyer",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "contentId", type: "uint256" },
      { internalType: "address", name: "buyer", type: "address" },
    ],
    name: "hasAccess",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "sellerBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256[]", name: "contentIds", type: "uint256[]" }],
    name: "getMyAnalytics",
    outputs: [{ internalType: "euint32[]", name: "counts", type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "hasPaid",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
