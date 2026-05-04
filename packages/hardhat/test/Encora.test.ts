import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import hre from "hardhat";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { expect } from "chai";
import { ethers } from "hardhat";

const TASK_COFHE_MOCKS_DEPLOY = "task:cofhe-mocks:deploy";

// Helper: build 8 encrypted uint32 chunks from a fake 32-byte key
async function encryptKeyChunks(client: Awaited<ReturnType<typeof hre.cofhe.createClientWithBatteries>>, chunks: bigint[]) {
  return client.encryptInputs(chunks.map((c) => Encryptable.uint32(c))).execute();
}

describe("Encora", function () {
  async function deployFixture() {
    await hre.run(TASK_COFHE_MOCKS_DEPLOY);

    const [deployer, seller, buyer, buyer2] = await hre.ethers.getSigners();

    const Encora = await hre.ethers.getContractFactory("Encora");
    const contract = await Encora.connect(deployer).deploy();

    const sellerClient = await hre.cofhe.createClientWithBatteries(seller);
    const buyerClient = await hre.cofhe.createClientWithBatteries(buyer);

    // Fake AES key as 8 × uint32 chunks
    const keyChunks: bigint[] = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
    const encChunks = await encryptKeyChunks(sellerClient, keyChunks);

    const PRICE = ethers.parseEther("0.01");
    const FAKE_ENCRYPTED_CONTENT = ethers.toUtf8Bytes("iv_bytes_plus_ciphertext");

    return { contract, deployer, seller, buyer, buyer2, sellerClient, buyerClient, encChunks, keyChunks, PRICE, FAKE_ENCRYPTED_CONTENT };
  }

  // ─────────────────────────────────────────────
  // UPLOAD
  // ─────────────────────────────────────────────

  describe("uploadContent", function () {
    it("stores metadata and emits ContentUploaded", async function () {
      const { contract, seller, encChunks, PRICE, FAKE_ENCRYPTED_CONTENT } = await loadFixture(deployFixture);

      await expect(
        contract.connect(seller).uploadContent(
          "Keto Diet Plan",
          "A 30-day keto plan",
          "Preview: low-carb, high-fat meals...",
          FAKE_ENCRYPTED_CONTENT,
          encChunks,
          "diet",
          PRICE
        )
      ).to.emit(contract, "ContentUploaded").withArgs(0n, seller.address, "Keto Diet Plan", "diet");

      const info = await contract.getContent(0n);
      expect(info.title).to.equal("Keto Diet Plan");
      expect(info.seller).to.equal(seller.address);
      expect(info.price).to.equal(PRICE);
      expect(info.active).to.be.true;
      expect(info.keyChunks).to.equal(8n);
    });

    it("reverts if not exactly 8 key chunks", async function () {
      const { contract, seller, sellerClient, PRICE, FAKE_ENCRYPTED_CONTENT } = await loadFixture(deployFixture);

      const badChunks = await encryptKeyChunks(sellerClient, [1n, 2n, 3n]);
      await expect(
        contract.connect(seller).uploadContent("T", "D", "P", FAKE_ENCRYPTED_CONTENT, badChunks, "diet", PRICE)
      ).to.be.revertedWithCustomError(contract, "InvalidKeyChunks");
    });

    it("increments contentCount", async function () {
      const { contract, seller, encChunks, PRICE, FAKE_ENCRYPTED_CONTENT } = await loadFixture(deployFixture);

      await contract.connect(seller).uploadContent("A", "D", "P", FAKE_ENCRYPTED_CONTENT, encChunks, "diet", PRICE);
      await contract.connect(seller).uploadContent("B", "D", "P", FAKE_ENCRYPTED_CONTENT, encChunks, "fitness", PRICE);
      expect(await contract.contentCount()).to.equal(2n);
    });
  });

  // ─────────────────────────────────────────────
  // PURCHASE
  // ─────────────────────────────────────────────

  describe("purchase", function () {
    async function withContent() {
      const f = await loadFixture(deployFixture);
      await f.contract.connect(f.seller).uploadContent(
        "Plan", "Desc", "Preview", f.FAKE_ENCRYPTED_CONTENT, f.encChunks, "diet", f.PRICE
      );
      return f;
    }

    it("sets hasPaid and emits ContentPurchased", async function () {
      const { contract, buyer, PRICE } = await withContent();

      await expect(contract.connect(buyer).purchase(0n, { value: PRICE }))
        .to.emit(contract, "ContentPurchased").withArgs(0n, buyer.address);

      expect(await contract.hasPaid(0n, buyer.address)).to.be.true;
    });

    it("reverts with InsufficientPayment if underpaid", async function () {
      const { contract, buyer, PRICE } = await withContent();

      await expect(
        contract.connect(buyer).purchase(0n, { value: PRICE - 1n })
      ).to.be.revertedWithCustomError(contract, "InsufficientPayment");
    });

    it("reverts on inactive content", async function () {
      const { contract, seller, buyer, PRICE } = await withContent();

      await contract.connect(seller).deactivate(0n);
      await expect(
        contract.connect(buyer).purchase(0n, { value: PRICE })
      ).to.be.revertedWithCustomError(contract, "ContentNotActive");
    });

    it("accumulates sellerBalance", async function () {
      const { contract, seller, buyer, PRICE } = await withContent();

      await contract.connect(buyer).purchase(0n, { value: PRICE });
      expect(await contract.sellerBalance(seller.address)).to.equal(PRICE);
    });
  });

  // ─────────────────────────────────────────────
  // REQUEST ACCESS
  // ─────────────────────────────────────────────

  describe("requestAccess", function () {
    const PUB_KEY_X = ethers.zeroPadBytes("0xdeadbeef", 32) as `0x${string}`;
    const PUB_KEY_Y = ethers.zeroPadBytes("0xcafebabe", 32) as `0x${string}`;

    async function withPurchase() {
      const f = await loadFixture(deployFixture);
      await f.contract.connect(f.seller).uploadContent(
        "Plan", "Desc", "Preview", f.FAKE_ENCRYPTED_CONTENT, f.encChunks, "diet", f.PRICE
      );
      await f.contract.connect(f.buyer).purchase(0n, { value: f.PRICE });
      return f;
    }

    it("reverts NotPurchased if buyer has not paid", async function () {
      const { contract, buyer2 } = await withPurchase();

      await expect(
        contract.connect(buyer2).requestAccess(0n, PUB_KEY_X, PUB_KEY_Y)
      ).to.be.revertedWithCustomError(contract, "NotPurchased");
    });

    it("grants access and emits AccessGranted", async function () {
      const { contract, buyer } = await withPurchase();

      await expect(
        contract.connect(buyer).requestAccess(0n, PUB_KEY_X, PUB_KEY_Y)
      ).to.emit(contract, "AccessGranted").withArgs(0n, buyer.address);
    });

    it("returns 8 sealed key chunk handles", async function () {
      const { contract, buyer } = await withPurchase();

      const sealed = await contract.connect(buyer).requestAccess.staticCall(0n, PUB_KEY_X, PUB_KEY_Y);
      expect(sealed.length).to.equal(8);
    });

    it("reverts PubKeyAlreadyUsed on second call with same key", async function () {
      const { contract, buyer } = await withPurchase();

      await contract.connect(buyer).requestAccess(0n, PUB_KEY_X, PUB_KEY_Y);
      await expect(
        contract.connect(buyer).requestAccess(0n, PUB_KEY_X, PUB_KEY_Y)
      ).to.be.revertedWithCustomError(contract, "PubKeyAlreadyUsed");
    });

    it("buyer can unseal key chunks and recover original values", async function () {
      const { contract, buyer, buyerClient, keyChunks } = await withPurchase();

      await contract.connect(buyer).requestAccess(0n, PUB_KEY_X, PUB_KEY_Y);

      // Verify each chunk plaintext via mock
      const sealed = await contract.connect(buyer).requestAccess.staticCall(
        0n,
        ethers.zeroPadBytes("0x1111", 32) as `0x${string}`,
        ethers.zeroPadBytes("0x2222", 32) as `0x${string}`
      );

      // Use mock to verify plaintext values match what seller uploaded
      for (let i = 0; i < 8; i++) {
        await hre.cofhe.mocks.expectPlaintext(sealed[i], keyChunks[i]);
      }
    });
  });

  // ─────────────────────────────────────────────
  // WITHDRAW
  // ─────────────────────────────────────────────

  describe("withdraw", function () {
    it("transfers ETH to seller and zeroes balance", async function () {
      const { contract, seller, buyer, PRICE } = await loadFixture(deployFixture);

      const encChunks2 = (await loadFixture(deployFixture)).encChunks;
      await contract.connect(seller).uploadContent("P", "D", "Prev", ethers.toUtf8Bytes("enc"), encChunks2, "diet", PRICE);
      await contract.connect(buyer).purchase(0n, { value: PRICE });

      const before = await ethers.provider.getBalance(seller.address);
      const tx = await contract.connect(seller).withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const after = await ethers.provider.getBalance(seller.address);

      expect(after).to.equal(before + PRICE - gasUsed);
      expect(await contract.sellerBalance(seller.address)).to.equal(0n);
    });

    it("reverts WithdrawFailed if no balance", async function () {
      const { contract, seller } = await loadFixture(deployFixture);
      await expect(contract.connect(seller).withdraw())
        .to.be.revertedWithCustomError(contract, "WithdrawFailed");
    });
  });

  // ─────────────────────────────────────────────
  // LISTING / PAGINATION
  // ─────────────────────────────────────────────

  describe("listContents / listByCategory", function () {
    async function withMultiple() {
      const f = await loadFixture(deployFixture);
      const { contract, seller, encChunks, PRICE, FAKE_ENCRYPTED_CONTENT } = f;
      await contract.connect(seller).uploadContent("Diet A", "D", "P", FAKE_ENCRYPTED_CONTENT, encChunks, "diet", PRICE);
      await contract.connect(seller).uploadContent("Fitness B", "D", "P", FAKE_ENCRYPTED_CONTENT, encChunks, "fitness", PRICE);
      await contract.connect(seller).uploadContent("Diet C", "D", "P", FAKE_ENCRYPTED_CONTENT, encChunks, "diet", PRICE);
      return f;
    }

    it("listContents returns all active items with pagination", async function () {
      const { contract } = await withMultiple();
      const page = await contract.listContents(0n, 10n);
      expect(page.length).to.equal(3);
    });

    it("listByCategory filters correctly", async function () {
      const { contract } = await withMultiple();
      const diets = await contract.listByCategory("diet", 0n, 10n);
      expect(diets.length).to.equal(2);
      expect(diets[0].category).to.equal("diet");
      expect(diets[1].category).to.equal("diet");
    });

    it("deactivated content is excluded from listings", async function () {
      const { contract, seller } = await withMultiple();
      await contract.connect(seller).deactivate(0n);
      const page = await contract.listContents(0n, 10n);
      expect(page.length).to.equal(2);
    });

    it("hasAccess returns false before purchase, true after", async function () {
      const { contract, seller, buyer, encChunks, PRICE, FAKE_ENCRYPTED_CONTENT } = await loadFixture(deployFixture);
      await contract.connect(seller).uploadContent("X", "D", "P", FAKE_ENCRYPTED_CONTENT, encChunks, "diet", PRICE);
      expect(await contract.hasAccess(0n, buyer.address)).to.be.false;
      await contract.connect(buyer).purchase(0n, { value: PRICE });
      expect(await contract.hasAccess(0n, buyer.address)).to.be.true;
    });
  });
});
