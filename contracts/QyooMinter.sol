// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {QyooRegistry} from "./QyooRegistry.sol";

/// @title Qyoo Minter
/// @notice Replaceable commercial issuance layer for the permanent Qyoo Registry.
contract QyooMinter is Ownable, Pausable, ReentrancyGuard, EIP712 {
    enum MintTier {
        Random,
        Custom
    }

    struct MintVoucher {
        uint256 tokenId;
        address recipient;
        uint8 tier;
        uint256 price;
        uint256 nonce;
        uint256 deadline;
        uint256 pricingVersion;
        bytes32 resolverHash;
    }

    bytes32 public constant MINT_VOUCHER_TYPEHASH = keccak256(
        "MintVoucher(uint256 tokenId,address recipient,uint8 tier,uint256 price,uint256 nonce,uint256 deadline,uint256 pricingVersion,bytes32 resolverHash)"
    );

    QyooRegistry public immutable registry;

    address public authorizer;
    address payable public revenueRecipient;
    uint256 public randomPrice;
    uint256 public customPrice;
    uint256 public pricingVersion = 1;

    mapping(address recipient => mapping(uint256 nonce => bool used)) public usedNonces;

    error EmptyBalance();
    error ExpiredVoucher(uint256 deadline);
    error IncorrectPayment(uint256 expected, uint256 actual);
    error InvalidAddress(address value);
    error InvalidPricingVersion(uint256 expected, uint256 actual);
    error InvalidRecipient(address expected, address actual);
    error InvalidResolverHash(bytes32 expected, bytes32 actual);
    error InvalidSignature(address recovered, address expected);
    error InvalidTier(uint8 tier);
    error InvalidVoucherPrice(uint256 expected, uint256 actual);
    error NonceAlreadyUsed(address recipient, uint256 nonce);
    error WithdrawalFailed(address recipient, uint256 amount);

    event AuthorizerChanged(address indexed previousAuthorizer, address indexed newAuthorizer);
    event PricesChanged(
        uint256 randomPrice,
        uint256 customPrice,
        uint256 indexed pricingVersion
    );
    event RevenueRecipientChanged(
        address indexed previousRecipient,
        address indexed newRecipient
    );
    event VoucherRedeemed(
        bytes32 indexed digest,
        uint256 indexed tokenId,
        address indexed recipient,
        MintTier tier,
        uint256 price,
        uint256 nonce
    );
    event RevenueWithdrawn(address indexed recipient, uint256 amount);

    constructor(
        QyooRegistry registry_,
        address initialOwner,
        address initialAuthorizer,
        address payable initialRevenueRecipient,
        uint256 initialRandomPrice,
        uint256 initialCustomPrice
    ) Ownable(initialOwner) EIP712("QyooMinter", "1") {
        if (address(registry_) == address(0)) revert InvalidAddress(address(registry_));
        if (initialAuthorizer == address(0)) revert InvalidAddress(initialAuthorizer);
        if (initialRevenueRecipient == address(0)) revert InvalidAddress(initialRevenueRecipient);

        registry = registry_;
        authorizer = initialAuthorizer;
        revenueRecipient = initialRevenueRecipient;
        randomPrice = initialRandomPrice;
        customPrice = initialCustomPrice;
    }

    /// @notice Redeem a non-transferable issuer authorization for an exact ID.
    function redeem(
        MintVoucher calldata voucher,
        string calldata resolver,
        bytes calldata signature
    ) external payable whenNotPaused nonReentrant {
        if (voucher.recipient != msg.sender) {
            revert InvalidRecipient(voucher.recipient, msg.sender);
        }
        if (voucher.tier > uint8(MintTier.Custom)) revert InvalidTier(voucher.tier);
        if (block.timestamp > voucher.deadline) revert ExpiredVoucher(voucher.deadline);
        if (voucher.pricingVersion != pricingVersion) {
            revert InvalidPricingVersion(pricingVersion, voucher.pricingVersion);
        }

        bytes32 actualResolverHash = keccak256(bytes(resolver));
        if (voucher.resolverHash != actualResolverHash) {
            revert InvalidResolverHash(voucher.resolverHash, actualResolverHash);
        }

        uint256 expectedPrice = priceForTier(voucher.tier);
        if (voucher.price != expectedPrice) {
            revert InvalidVoucherPrice(expectedPrice, voucher.price);
        }
        if (msg.value != expectedPrice) revert IncorrectPayment(expectedPrice, msg.value);
        if (usedNonces[voucher.recipient][voucher.nonce]) {
            revert NonceAlreadyUsed(voucher.recipient, voucher.nonce);
        }

        bytes32 digest = hashVoucher(voucher);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != authorizer) revert InvalidSignature(recovered, authorizer);

        // Effects before interaction. A failed Registry mint reverts this write.
        usedNonces[voucher.recipient][voucher.nonce] = true;
        registry.mint(voucher.recipient, voucher.tokenId, resolver);

        emit VoucherRedeemed(
            digest,
            voucher.tokenId,
            voucher.recipient,
            MintTier(voucher.tier),
            voucher.price,
            voucher.nonce
        );
    }

    function hashVoucher(MintVoucher calldata voucher) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    MINT_VOUCHER_TYPEHASH,
                    voucher.tokenId,
                    voucher.recipient,
                    voucher.tier,
                    voucher.price,
                    voucher.nonce,
                    voucher.deadline,
                    voucher.pricingVersion,
                    voucher.resolverHash
                )
            )
        );
    }

    function priceForTier(uint8 tier) public view returns (uint256) {
        if (tier == uint8(MintTier.Random)) return randomPrice;
        if (tier == uint8(MintTier.Custom)) return customPrice;
        revert InvalidTier(tier);
    }

    /// @notice Update future mint pricing and invalidate vouchers from the previous version.
    function setPrices(uint256 newRandomPrice, uint256 newCustomPrice) external onlyOwner {
        randomPrice = newRandomPrice;
        customPrice = newCustomPrice;
        unchecked {
            ++pricingVersion;
        }
        emit PricesChanged(newRandomPrice, newCustomPrice, pricingVersion);
    }

    /// @notice Replace the signer trusted to authorize future issuance.
    function setAuthorizer(address newAuthorizer) external onlyOwner {
        if (newAuthorizer == address(0)) revert InvalidAddress(newAuthorizer);
        address previousAuthorizer = authorizer;
        authorizer = newAuthorizer;
        emit AuthorizerChanged(previousAuthorizer, newAuthorizer);
    }

    function setRevenueRecipient(address payable newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidAddress(newRecipient);
        address previousRecipient = revenueRecipient;
        revenueRecipient = newRecipient;
        emit RevenueRecipientChanged(previousRecipient, newRecipient);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Withdraw all accumulated mint proceeds to the configured business recipient.
    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert EmptyBalance();
        address payable recipient = revenueRecipient;
        (bool success, ) = recipient.call{value: amount}("");
        if (!success) revert WithdrawalFailed(recipient, amount);
        emit RevenueWithdrawn(recipient, amount);
    }
}
