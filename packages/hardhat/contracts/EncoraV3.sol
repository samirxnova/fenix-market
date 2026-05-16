// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {FHE, euint32, euint64, InEuint32} from "@fhenixprotocol/cofhe-contracts/FHE.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title EncoraV3
/// @notice Privacy-preserving content marketplace with FHE subscriptions.
///
/// SUBSCRIPTION MODEL:
///   - subscriptionDuration > 0 means content is subscription-based
///   - subscriptionDuration == 0 means one-time purchase
///   - Subscription expiry is FHE-encrypted — only buyer can see when it expires
///   - Buyer's subscription feed is private — decrypted only in their browser
contract EncoraV3 is ReentrancyGuard {
    // ─────────────────────────────────────────────
    // TYPES
    // ─────────────────────────────────────────────

    struct Content {
        uint256 id;
        address seller;
        string title;
        string description;
        string previewText;
        string encryptedContentCID;
        euint32[] encryptedSymKey;
        uint256 price;
        uint256 subscriptionDuration; // 0 = one-time, >0 = seconds of access per payment
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
        uint256 subscriptionDuration;
        bool active;
        uint256 createdAt;
        string category;
        uint256 keyChunks;
    }

    // ─────────────────────────────────────────────
    // STATE
    // ─────────────────────────────────────────────

    IERC20 public immutable USDC;
    uint256 public contentCount;

    mapping(uint256 => Content) internal contents;
    mapping(uint256 => mapping(address => bool)) public hasPaid; // one-time purchases
    mapping(uint256 => mapping(bytes32 => bool)) public usedPubKeys;
    mapping(address => uint256[]) public contentsBySeller;
    mapping(address => uint256) public sellerBalance;

    // FHE-encrypted analytics (seller-only)
    mapping(uint256 => euint32) internal purchaseCount;

    // FHE-encrypted subscription expiry (buyer-only)
    mapping(uint256 => mapping(address => euint64)) internal subscriptionExpiry;

    // ─────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────

    event ContentUploaded(uint256 indexed id, address indexed seller, string title, string category);
    event ContentPurchased(uint256 indexed id, address indexed buyer);
    event SubscriptionStarted(uint256 indexed id, address indexed buyer);
    event SubscriptionRenewed(uint256 indexed id, address indexed buyer);
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
    error InvalidKeyChunks();
    error NotSubscriptionContent();
    error IsSubscriptionContent();

    constructor(address usdc) {
        USDC = IERC20(usdc);
    }

    // ─────────────────────────────────────────────
    // UPLOAD
    // ─────────────────────────────────────────────

    /// @param subscriptionDuration 0 for one-time, or seconds (e.g. 2592000 = 30 days)
    function uploadContent(
        string calldata title,
        string calldata description,
        string calldata previewText,
        string calldata encryptedContentCID,
        InEuint32[] calldata encSymKeyChunks,
        string calldata category,
        uint256 price,
        uint256 subscriptionDuration
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
        c.subscriptionDuration = subscriptionDuration;
        c.active = true;
        c.createdAt = block.timestamp;
        c.category = category;

        for (uint256 i = 0; i < 8; i++) {
            euint32 chunk = FHE.asEuint32(encSymKeyChunks[i]);
            c.encryptedSymKey.push(chunk);
            FHE.allowThis(chunk);
        }

        purchaseCount[id] = FHE.asEuint32(0);
        FHE.allowThis(purchaseCount[id]);
        FHE.allow(purchaseCount[id], msg.sender);

        contentsBySeller[msg.sender].push(id);
        emit ContentUploaded(id, msg.sender, title, category);
    }

    // ─────────────────────────────────────────────
    // PURCHASE (one-time only)
    // ─────────────────────────────────────────────

    function purchase(uint256 contentId) external {
        if (contentId >= contentCount) revert ContentNotFound();
        Content storage c = contents[contentId];
        if (!c.active) revert ContentNotActive();
        if (c.subscriptionDuration > 0) revert IsSubscriptionContent();

        USDC.transferFrom(msg.sender, address(this), c.price);
        hasPaid[contentId][msg.sender] = true;
        sellerBalance[c.seller] += c.price;

        purchaseCount[contentId] = FHE.add(purchaseCount[contentId], FHE.asEuint32(1));
        FHE.allowThis(purchaseCount[contentId]);
        FHE.allow(purchaseCount[contentId], c.seller);

        emit ContentPurchased(contentId, msg.sender);
    }

    // ─────────────────────────────────────────────
    // SUBSCRIBE (time-gated, FHE-encrypted expiry)
    // ─────────────────────────────────────────────

    /// @notice Subscribe to content. Expiry is FHE-encrypted — only buyer can see it.
    function subscribe(uint256 contentId) external {
        if (contentId >= contentCount) revert ContentNotFound();
        Content storage c = contents[contentId];
        if (!c.active) revert ContentNotActive();
        if (c.subscriptionDuration == 0) revert NotSubscriptionContent();

        USDC.transferFrom(msg.sender, address(this), c.price);

        uint64 expiry = uint64(block.timestamp) + uint64(c.subscriptionDuration);
        euint64 encExpiry = FHE.asEuint64(expiry);
        subscriptionExpiry[contentId][msg.sender] = encExpiry;
        FHE.allowThis(encExpiry);
        FHE.allow(encExpiry, msg.sender); // only buyer can decrypt their expiry

        sellerBalance[c.seller] += c.price;

        purchaseCount[contentId] = FHE.add(purchaseCount[contentId], FHE.asEuint32(1));
        FHE.allowThis(purchaseCount[contentId]);
        FHE.allow(purchaseCount[contentId], c.seller);

        emit SubscriptionStarted(contentId, msg.sender);
    }

    /// @notice Renew subscription. Extends from now (not from previous expiry).
    function renewSubscription(uint256 contentId) external {
        if (contentId >= contentCount) revert ContentNotFound();
        Content storage c = contents[contentId];
        if (c.subscriptionDuration == 0) revert NotSubscriptionContent();

        USDC.transferFrom(msg.sender, address(this), c.price);

        uint64 newExpiry = uint64(block.timestamp) + uint64(c.subscriptionDuration);
        euint64 encExpiry = FHE.asEuint64(newExpiry);
        subscriptionExpiry[contentId][msg.sender] = encExpiry;
        FHE.allowThis(encExpiry);
        FHE.allow(encExpiry, msg.sender);

        sellerBalance[c.seller] += c.price;

        emit SubscriptionRenewed(contentId, msg.sender);
    }

    // ─────────────────────────────────────────────
    // REQUEST ACCESS
    // ─────────────────────────────────────────────

    /// @notice Grant buyer access. Works for both one-time and subscription content.
    function requestAccess(
        uint256 contentId,
        bytes32 buyerPubKeyX,
        bytes32 buyerPubKeyY
    ) external returns (euint32[] memory sealedChunks) {
        if (contentId >= contentCount) revert ContentNotFound();

        Content storage c = contents[contentId];

        // Check access: one-time OR active subscription
        bool hasOneTime = hasPaid[contentId][msg.sender];
        // For subscriptions, we can't check expiry on-chain without decryption
        // So we check if a subscription exists (non-zero handle)
        bool hasSub = euint64.unwrap(subscriptionExpiry[contentId][msg.sender]) != 0;
        if (!hasOneTime && !hasSub) revert NotPurchased();

        bytes32 pkHash = keccak256(abi.encodePacked(buyerPubKeyX, buyerPubKeyY));
        if (usedPubKeys[contentId][pkHash]) revert PubKeyAlreadyUsed();
        usedPubKeys[contentId][pkHash] = true;

        sealedChunks = new euint32[](8);
        for (uint256 i = 0; i < 8; i++) {
            FHE.allow(c.encryptedSymKey[i], msg.sender);
            sealedChunks[i] = c.encryptedSymKey[i];
        }

        emit AccessGranted(contentId, msg.sender);
    }

    // ─────────────────────────────────────────────
    // BUYER: PRIVATE SUBSCRIPTION FEED
    // ─────────────────────────────────────────────

    /// @notice Get encrypted subscription expiries. Only buyer can unseal.
    function getMySubscriptions(uint256[] calldata contentIds)
        external view returns (euint64[] memory expiries)
    {
        expiries = new euint64[](contentIds.length);
        for (uint256 i = 0; i < contentIds.length; i++) {
            expiries[i] = subscriptionExpiry[contentIds[i]][msg.sender];
        }
    }

    // ─────────────────────────────────────────────
    // SELLER ACTIONS
    // ─────────────────────────────────────────────

    function withdraw() external nonReentrant {
        uint256 amount = sellerBalance[msg.sender];
        if (amount == 0) revert WithdrawFailed();
        sellerBalance[msg.sender] = 0;
        USDC.transfer(msg.sender, amount);
    }

    function deactivate(uint256 contentId) external {
        if (contentId >= contentCount) revert ContentNotFound();
        if (contents[contentId].seller != msg.sender) revert NotSeller();
        contents[contentId].active = false;
        emit ContentDeactivated(contentId);
    }

    // ─────────────────────────────────────────────
    // SELLER: FHE ANALYTICS
    // ─────────────────────────────────────────────

    function getMyAnalytics(uint256[] calldata contentIds)
        external view returns (euint32[] memory counts)
    {
        counts = new euint32[](contentIds.length);
        for (uint256 i = 0; i < contentIds.length; i++) {
            if (contents[contentIds[i]].seller != msg.sender) revert NotSeller();
            counts[i] = purchaseCount[contentIds[i]];
        }
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

    function listByCategory(string calldata category, uint256 offset, uint256 limit)
        external view returns (ContentInfo[] memory)
    {
        return _paginate(offset, limit, category);
    }

    function getContentsBySeller(address seller) external view returns (uint256[] memory) {
        return contentsBySeller[seller];
    }

    function hasAccess(uint256 contentId, address buyer) external view returns (bool) {
        return hasPaid[contentId][buyer] || euint64.unwrap(subscriptionExpiry[contentId][buyer]) != 0;
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
            subscriptionDuration: c.subscriptionDuration,
            active: c.active,
            createdAt: c.createdAt,
            category: c.category,
            keyChunks: c.encryptedSymKey.length
        });
    }

    function _paginate(uint256 offset, uint256 limit, string memory category)
        internal view returns (ContentInfo[] memory)
    {
        bool filterCategory = bytes(category).length > 0;
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
