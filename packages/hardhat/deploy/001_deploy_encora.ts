import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// USDC on Arbitrum Sepolia (Circle official)
const USDC_ARB_SEPOLIA = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
// USDC on Base Sepolia
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const USDC_BY_NETWORK: Record<string, string> = {
  "arb-sepolia": USDC_ARB_SEPOLIA,
  "base-sepolia": USDC_BASE_SEPOLIA,
};

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const usdc = USDC_BY_NETWORK[hre.network.name] || USDC_ARB_SEPOLIA;
  console.log(`Deploying Encora on ${hre.network.name} with USDC: ${usdc}`);

  const result = await deploy("Encora", {
    from: deployer,
    args: [usdc],
    log: true,
    autoMine: true,
  });

  console.log("Encora deployed to:", result.address);

  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    await new Promise((resolve) => setTimeout(resolve, 30000));
    try {
      await hre.run("verify:verify", { address: result.address, constructorArguments: [usdc] });
      console.log("Contract verified!");
    } catch (e: unknown) {
      const err = e as Error;
      if (err.message.includes("Already Verified")) console.log("Already verified.");
      else console.error("Verification failed:", err.message);
    }
  }
};

export default deploy;
deploy.tags = ["Encora", "all"];
