// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Utils} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Utils.sol";

/// @title Qyoo Registry
/// @notice Permanent ownership and resolution state for 36-bit visual Qyoo IDs.
/// @dev This contract is intentionally non-upgradeable and exposes no burn path.
contract QyooRegistry is ERC721, Ownable {
    uint256 public constant MAX_QYOO_ID = (1 << 36) - 1;
    uint256 public constant MAX_RESOLVER_LENGTH = 256;

    mapping(address authority => bool authorized) private _mintAuthorities;
    mapping(uint256 tokenId => bool issued) private _issued;
    mapping(uint256 tokenId => address controller) private _controllers;
    mapping(uint256 tokenId => string resolver) private _resolvers;

    bool public mintingPaused;

    error InvalidMintAuthority(address authority);
    error InvalidQyooId(uint256 tokenId);
    error MintingPaused();
    error NotMintAuthority(address caller);
    error NotQyooOwner(address caller, uint256 tokenId);
    error NotResolverOperator(address caller, uint256 tokenId);
    error QyooAlreadyIssued(uint256 tokenId);
    error ResolverEmpty();
    error ResolverTooLong(uint256 length);

    event ControllerChanged(
        uint256 indexed tokenId,
        address indexed previousController,
        address indexed newController,
        address changedBy
    );
    event MintAuthorityChanged(address indexed authority, bool authorized);
    event MintingPauseChanged(bool paused);
    event QyooMinted(
        uint256 indexed tokenId,
        address indexed tokenOwner,
        address indexed mintAuthority,
        string resolver
    );
    event ResolverChanged(
        uint256 indexed tokenId,
        string previousResolver,
        string newResolver,
        address indexed changedBy
    );

    constructor(address initialAdmin) ERC721("Qyoo", "QYOO") Ownable(initialAdmin) {}

    /// @notice Authorize or revoke an issuer for future, previously unused Qyoo IDs.
    function setMintAuthority(address authority, bool authorized) external onlyOwner {
        if (authority == address(0)) revert InvalidMintAuthority(authority);
        _mintAuthorities[authority] = authorized;
        emit MintAuthorityChanged(authority, authorized);
    }

    /// @notice Pause or resume creation of new Qyoos. Existing-holder operations remain available.
    function setMintingPaused(bool paused) external onlyOwner {
        mintingPaused = paused;
        emit MintingPauseChanged(paused);
    }

    /// @notice Mint an exact 36-bit Qyoo ID with token-specific resolution state.
    /// @dev Only an authorized mint authority may call this function.
    function mint(address to, uint256 tokenId, string calldata resolver) external {
        if (!_mintAuthorities[msg.sender]) revert NotMintAuthority(msg.sender);
        if (mintingPaused) revert MintingPaused();
        if (tokenId > MAX_QYOO_ID) revert InvalidQyooId(tokenId);
        if (_issued[tokenId]) revert QyooAlreadyIssued(tokenId);
        _validateResolver(resolver);

        // Commit identity and explicit resolution state before invoking a contract
        // recipient. Initial events precede any legitimate state update made from
        // its receiver callback, preserving deterministic independent indexing.
        _issued[tokenId] = true;
        _resolvers[tokenId] = resolver;
        _mint(to, tokenId);
        emit ResolverChanged(tokenId, "", resolver, msg.sender);
        emit QyooMinted(tokenId, to, msg.sender, resolver);
        ERC721Utils.checkOnERC721Received(msg.sender, address(0), to, tokenId, "");
    }

    /// @notice Set or revoke the delegated resolver controller.
    /// @dev ERC-721 approvals do not grant protocol-controller authority.
    function setController(uint256 tokenId, address newController) external {
        address tokenOwner = ownerOf(tokenId);
        if (msg.sender != tokenOwner) revert NotQyooOwner(msg.sender, tokenId);

        address previousController = _controllers[tokenId];
        _controllers[tokenId] = newController;
        emit ControllerChanged(tokenId, previousController, newController, msg.sender);
    }

    /// @notice Change a Qyoo's explicit resolver pointer.
    /// @dev Only the current token owner or delegated controller may update it.
    function setResolver(uint256 tokenId, string calldata newResolver) external {
        address tokenOwner = ownerOf(tokenId);
        address controller = _controllers[tokenId];
        if (msg.sender != tokenOwner && msg.sender != controller) {
            revert NotResolverOperator(msg.sender, tokenId);
        }
        _validateResolver(newResolver);

        string memory previousResolver = _resolvers[tokenId];
        _resolvers[tokenId] = newResolver;
        emit ResolverChanged(tokenId, previousResolver, newResolver, msg.sender);
    }

    function isMintAuthority(address authority) external view returns (bool) {
        return _mintAuthorities[authority];
    }

    /// @notice True forever after an ID has been successfully minted.
    function wasIssued(uint256 tokenId) external view returns (bool) {
        return _issued[tokenId];
    }

    function controllerOf(uint256 tokenId) public view returns (address) {
        ownerOf(tokenId);
        return _controllers[tokenId];
    }

    function resolverOf(uint256 tokenId) public view returns (string memory) {
        ownerOf(tokenId);
        return _resolvers[tokenId];
    }

    /// @notice One-call read for scanners, resolvers, and independent indexers.
    function resolutionOf(
        uint256 tokenId
    ) external view returns (address tokenOwner, address controller, string memory resolver) {
        tokenOwner = ownerOf(tokenId);
        controller = _controllers[tokenId];
        resolver = _resolvers[tokenId];
    }

    /// @dev Clears delegated authority whenever ownership actually changes.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        from = super._update(to, tokenId, auth);
        if (from != address(0) && to != from) {
            address previousController = _controllers[tokenId];
            if (previousController != address(0)) {
                delete _controllers[tokenId];
                emit ControllerChanged(tokenId, previousController, address(0), from);
            }
        }
    }

    function _validateResolver(string calldata resolver) private pure {
        uint256 length = bytes(resolver).length;
        if (length == 0) revert ResolverEmpty();
        if (length > MAX_RESOLVER_LENGTH) revert ResolverTooLong(length);
    }
}
