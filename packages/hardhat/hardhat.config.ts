import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@cofhe/hardhat-plugin";
import "hardhat-deploy";
import * as dotenv from "dotenv";

dotenv.config();

// Strip 0x prefix if present — Hardhat expects raw 32-byte hex
const rawKey = process.env.PRIVATE_KEY || "";
const PRIVATE_KEY = rawKey.startsWith("0x") ? rawKey.slice(2) : rawKey;

const config: HardhatUserConfig = {
  cofhe: { logMocks: true },
  solidity: {
    version: "0.8.25",
    settings: { evmVersion: "cancun", viaIR: true, optimizer: { enabled: true, runs: 200 } },
  },
  defaultNetwork: "hardhat",
  networks: {
    "base-sepolia": {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 84532,
    },
    "arb-sepolia": {
      url: process.env.ARB_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 421614,
    },
  },
  namedAccounts: { deployer: { default: 0 } },
};

export default config;
