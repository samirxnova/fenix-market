// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint32, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Encora
/// @notice Privacy-preserving text/markdown content marketplace using Fhenix FHE.
///
/// ENCRYPTION MODEL:
///   Layer 1 (off-chain): Seller AES-GCM encrypts full text → encryptedContent (bytes)
///   Layer 2 (on-chain):  Seller FHE-encrypts the 32-byte AES key as 8 × euint32 chunks
///
/// ACCESS FLOW:
///   1. Buyer calls purchase() with msg.value >= price
///   2. Buyer calls requestAccess(contentId, pubKeyX, pubKeyY)
///      → contract calls FHE.allow(chunk, buyer) for each key chunk
///      → buyer unseals chunks client-side via cofhejs.unseal()
///      → buyer reassembles AES key, decrypts content locally
///
/// NULLIFIER: each buyer public key can only be used once per content item.
contract Encora is ReentrancyGuard {
    // ─────────────────────────────────────────────
    // TYPES
    // ─────────────────────────────────────────────

    struct Content {
        uint256 id;
        address seller;
        string title;
        string description;
        string previewText;        // Public excerpt — used by AI chat
        string encryptedContentCID; // IPFS CID of AES-encrypted content
        euint32[] encryptedSymKey; // FHE-encrypted AES key: 8 × euint32 chunks
        uint256 price;             // Price in USDC (6 decimals)
        bool active;
        uint256 createdAt;
        string category;
    }

    struct ContentInfo {
        uint256 id;
        address seller;
        string title;
        string description;
        string previewText;
        string encryptedContentCID;
        uint256 price;
        bool active;
        uint256 createdAt;
        string category;
        uint256 keyChunks; // number of FHE key chunks (always 8)
    }

    // ─────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────

    IERC20 public immutable USDC; // 6 decimals — price stored in USDC units (e.g. 5_000000 = 5 USDC)
    uint256 public contentCount;

    mapping(uint256 => Content) internal contents;
    mapping(uint256 => mapping(address => bool)) public hasPaid;
    mapping(uint256 => mapping(bytes32 => bool)) public usedPubKeys; // nullifier
    mapping(address => uint256[]) public contentsBySeller;
    mapping(address => uint256[]) public purchasesByBuyer;
    mapping(address => uint256) public sellerBalance;

    // ─────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────

    event ContentUploaded(uint256 indexed id, address indexed seller, string title, string category);
    event ContentPurchased(uint256 indexed id, address indexed buyer);
    event AccessGranted(uint256 indexed id, address indexed buyer);
    event ContentDeactivated(uint256 indexed id);

    // ─────────────────────────────────────────────
    // ERRORS
    // ─────────────────────────────────────────────

    error ContentNotFound();
    error ContentNotActive();
    error NotPurchased();
    error PubKeyAlreadyUsed();
    error NotSeller();
    error WithdrawFailed();
    error InvalidKeyChunks(); // must be exactly 8

    constructor(address usdc) {
        USDC = IERC20(usdc);
    }

    // ─────────────────────────────────────────────
    // UPLOAD
    // ─────────────────────────────────────────────

    /// @notice Upload text/markdown content with FHE-protected AES key
    /// @param encSymKeyChunks Must be exactly 8 InEuint32 values (32-byte AES key split into 8 × uint32)
    function uploadContent(
        string calldata title,
        string calldata description,
        string calldata previewText,
        string calldata encryptedContentCID,
        InEuint32[] calldata encSymKeyChunks,
        string calldata category,
        uint256 price
    ) external returns (uint256 id) {
        if (encSymKeyChunks.length != 8) revert InvalidKeyChunks();

        id = contentCount++;
        Content storage c = contents[id];
        c.id = id;
        c.seller = msg.sender;
        c.title = title;
        c.description = description;
        c.previewText = previewText;
        c.encryptedContentCID = encryptedContentCID;
        c.price = price;
        c.active = true;
        c.createdAt = block.timestamp;
        c.category = category;

        for (uint256 i = 0; i < 8; i++) {
            euint32 chunk = FHE.asEuint32(encSymKeyChunks[i]);
            c.encryptedSymKey.push(chunk);
            FHE.allowThis(chunk); // contract must retain access to grant buyers later
        }

        contentsBySeller[msg.sender].push(id);
        emit ContentUploaded(id, msg.sender, title, category);
    }

    // ─────────────────────────────────────────────
    // PURCHASE
    // ─────────────────────────────────────────────

    /// @notice Pay for content access — buyer must approve this contract for `price` USDC first
    function purchase(uint256 contentId) external {
        if (contentId >= contentCount) revert ContentNotFound();
        Content storage c = contents[contentId];
        if (!c.active) revert ContentNotActive();

        USDC.transferFrom(msg.sender, address(this), c.price);

        hasPaid[contentId][msg.sender] = true;
        sellerBalance[c.seller] += c.price;
        purchasesByBuyer[msg.sender].push(contentId);

        emit ContentPurchased(contentId, msg.sender);
    }

    // ─────────────────────────────────────────────
    // REQUEST ACCESS
    // ─────────────────────────────────────────────

    /// @notice Grant buyer access to FHE-sealed AES key chunks.
    ///         Buyer must unseal each chunk client-side via cofhejs.unseal().
    /// @param buyerPubKeyX  X coordinate of buyer's cofhejs sealing public key
    /// @param buyerPubKeyY  Y coordinate of buyer's cofhejs sealing public key
    /// @return sealedChunks  The 8 euint32 handles — buyer can now unseal them with their permit
    function requestAccess(
        uint256 contentId,
        bytes32 buyerPubKeyX,
        bytes32 buyerPubKeyY
    ) external returns (euint32[] memory sealedChunks) {
        if (contentId >= contentCount) revert ContentNotFound();
        if (!hasPaid[contentId][msg.sender]) revert NotPurchased();

        bytes32 pkHash = keccak256(abi.encodePacked(buyerPubKeyX, buyerPubKeyY));
        if (usedPubKeys[contentId][pkHash]) revert PubKeyAlreadyUsed();
        usedPubKeys[contentId][pkHash] = true;

        Content storage c = contents[contentId];
        sealedChunks = new euint32[](8);
        for (uint256 i = 0; i < 8; i++) {
            FHE.allow(c.encryptedSymKey[i], msg.sender);
            sealedChunks[i] = c.encryptedSymKey[i];
        }

        emit AccessGranted(contentId, msg.sender);
    }

    // ─────────────────────────────────────────────
    // SELLER ACTIONS
    // ─────────────────────────────────────────────

    /// @notice Withdraw accumulated USDC earnings
    function withdraw() external nonReentrant {
        uint256 amount = sellerBalance[msg.sender];
        if (amount == 0) revert WithdrawFailed();
        sellerBalance[msg.sender] = 0;
        USDC.transfer(msg.sender, amount);
    }

    /// @notice Deactivate content (buyers who paid retain access)
    function deactivate(uint256 contentId) external {
        if (contentId >= contentCount) revert ContentNotFound();
        if (contents[contentId].seller != msg.sender) revert NotSeller();
        contents[contentId].active = false;
        emit ContentDeactivated(contentId);
    }

    // ─────────────────────────────────────────────
    // VIEW FUNCTIONS
    // ─────────────────────────────────────────────

    function getContent(uint256 id) external view returns (ContentInfo memory) {
        if (id >= contentCount) revert ContentNotFound();
        return _toInfo(contents[id]);
    }

    function listContents(uint256 offset, uint256 limit) external view returns (ContentInfo[] memory) {
        return _paginate(offset, limit, "");
    }

    function listByCategory(
        string calldata category,
        uint256 offset,
        uint256 limit
    ) external view returns (ContentInfo[] memory) {
        return _paginate(offset, limit, category);
    }

    function getContentsBySeller(address seller) external view returns (uint256[] memory) {
        return contentsBySeller[seller];
    }

    function getPurchasesByBuyer(address buyer) external view returns (uint256[] memory) {
        return purchasesByBuyer[buyer];
    }

    function hasAccess(uint256 contentId, address buyer) external view returns (bool) {
        return hasPaid[contentId][buyer];
    }

    // ─────────────────────────────────────────────
    // INTERNAL
    // ─────────────────────────────────────────────

    function _toInfo(Content storage c) internal view returns (ContentInfo memory) {
        return ContentInfo({
            id: c.id,
            seller: c.seller,
            title: c.title,
            description: c.description,
            previewText: c.previewText,
            encryptedContentCID: c.encryptedContentCID,
            price: c.price,
            active: c.active,
            createdAt: c.createdAt,
            category: c.category,
            keyChunks: c.encryptedSymKey.length
        });
    }

    function _paginate(
        uint256 offset,
        uint256 limit,
        string memory category
    ) internal view returns (ContentInfo[] memory) {
        bool filterCategory = bytes(category).length > 0;

        // Count matching active items
        uint256 total = 0;
        for (uint256 i = 0; i < contentCount; i++) {
            if (!contents[i].active) continue;
            if (filterCategory && keccak256(bytes(contents[i].category)) != keccak256(bytes(category))) continue;
            total++;
        }

        if (offset >= total) return new ContentInfo[](0);
        uint256 count = total - offset > limit ? limit : total - offset;

        ContentInfo[] memory result = new ContentInfo[](count);
        uint256 found = 0;
        uint256 skipped = 0;

        for (uint256 i = 0; i < contentCount && found < count; i++) {
            if (!contents[i].active) continue;
            if (filterCategory && keccak256(bytes(contents[i].category)) != keccak256(bytes(category))) continue;
            if (skipped < offset) { skipped++; continue; }
            result[found++] = _toInfo(contents[i]);
        }

        return result;
    }
}
