// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";        // Provides basic access control mechanisms, assigning an owner who can execute privileged operations
import "erc721a/contracts/ERC721A.sol";                     // Offers a gas-efficient implementation of the ERC721 standard, optimized for minting multiple tokens in a single transaction
import "erc721a/contracts/extensions/ERC721ABurnable.sol";  // Adds functionality to allow token holders to permanently destroy (burn) their tokens
import "@openzeppelin/contracts/utils/Pausable.sol";        // Enables the contract to be paused and unpaused by authorized accounts, halting certain functions during emergencies
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // Protects against reentrancy attacks by preventing nested calls to functions marked as `nonReentrant`
import "@openzeppelin/contracts/utils/Strings.sol";         // Utility library that provides functions for converting numeric types to strings and other string operations

contract Qyoo is ERC721A, ERC721ABurnable, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;

    uint public current_total = 0;
    uint256 public constant MAX_SUPPLY = (2**36) - 1;  // 2^(6*6) - 1

    uint public basic_max  = 400;
    uint256 public basic_price  = 0.001 ether;
    uint256 public random_price = 0.01 ether;
    uint256 public custom_price = 0.1 ether;

    uint256 public lifetime_fee = 1 ether;
    uint256 public renewalFee   = 0.005 ether;

    uint256 public basicExpiration  = 365 days;   // 1 year
    uint256 public randomExpiration = 1095 days;  // 3 years
    uint256 public customExpiration = 1825 days;  // 5 years

    address public withdrawalAddress = 0x16c492207a0a6758A2FfBb1984A5C517A3e5479A;

    struct TokenInfo {
        string url;
        string name;
        string icon;
        string description;
        uint256 expirationTimestamp;  // 0 means no expiration (lifetime ownership)
    }

    mapping(uint256 => TokenInfo) private _tokenInfo;

    string private _baseTokenURI;

    event TokenMinted(address indexed owner, uint256 indexed tokenId, uint256 expirationTimestamp);
    event TokenRenewed(address indexed owner, uint256 indexed tokenId, uint256 newExpirationTimestamp);
    event TokenReclaimed(uint256 indexed tokenId);
    event TokenExpirationExtended(uint256 indexed tokenId, uint256 newExpirationTimestamp);

    constructor() ERC721A("Qyoo 2d barcode token", "QYOO") Ownable(msg.sender) {}

    // Modifier to check if token is valid (not expired)
    modifier onlyValidToken(uint256 tokenId) {
        require(_exists(tokenId), "Token does not exist");
        require(!_isTokenExpired(tokenId), "Token is expired");
        _;
    }

    // Mint a basic token
    function mintBasicToken(
        string memory name,
        string memory url,
        string memory icon, // FIXME: remove this, make it hard-coded based on a owner changeable uri prefix
        string memory description,
        bool isLifetime
    ) external payable whenNotPaused {
        require(current_total < basic_max, "Max basic tokens reached");

        uint256 price = basic_price + (isLifetime ? lifetime_fee : 0);
        require(msg.value >= price, "Insufficient ETH for minting");

        uint256 tokenId = _generateBasicTokenId();
        require(!_exists(tokenId), "Token already exists"); // Ensure uniqueness

        uint256 expiration = isLifetime ? 0 : block.timestamp + basicExpiration;

        _mintToken(msg.sender, tokenId, name, url, icon, description, expiration);

        emit TokenMinted(msg.sender, tokenId, expiration);
    }

    // Mint a random token
    function mintRandomToken(
        string memory name,
        string memory url,
        string memory icon,
        string memory description,
        bool isLifetime
    ) external payable whenNotPaused {
        uint256 price = random_price + (isLifetime ? lifetime_fee : 0);
        require(msg.value >= price, "Insufficient ETH for minting");

        uint256 tokenId = _generateRandomTokenId();
        require(!_exists(tokenId), "Token already exists"); // Ensure uniqueness

        uint256 expiration = isLifetime ? 0 : block.timestamp + randomExpiration;

        _mintToken(msg.sender, tokenId, name, url, icon, description, expiration);

        emit TokenMinted(msg.sender, tokenId, expiration);
    }

    // Mint a custom token with specified ID if available
    function mintCustomToken(
        uint256 customId,
        string memory name,
        string memory url,
        string memory icon,
        string memory description,
        bool isLifetime
    ) external payable whenNotPaused {
        require(customId <= MAX_SUPPLY, "Invalid custom ID"); // this is wrong
        require(!_exists(customId), "Token with this ID already exists");

        uint256 price = custom_price + (isLifetime ? lifetime_fee : 0);
        require(msg.value >= price, "Insufficient ETH for minting");

        uint256 expiration = isLifetime ? 0 : block.timestamp + customExpiration;

        _mintToken(msg.sender, customId, name, url, icon, description, expiration);

        emit TokenMinted(msg.sender, customId, expiration);
    }

    // Owner-only batch minting for free
    function ownerMintTokens(
        address recipient,
        uint256[] memory tokenIds,
        string[] memory names,
        string[] memory urls,
        string[] memory icons,
        string[] memory descriptions,
        uint256[] memory expirations
    ) external onlyOwner {
        uint256 length = tokenIds.length;
        require(
            length == names.length &&
            length == urls.length &&
            length == icons.length &&
            length == descriptions.length &&
            length == expirations.length,
            "Invalid input data"
        );

        for (uint256 i = 0; i < length; i++) {
            uint256 tokenId = tokenIds[i];
            require(!_exists(tokenId), "Token ID already exists");
            _mintToken(recipient, tokenId, names[i], urls[i], icons[i], descriptions[i], expirations[i]);
            emit TokenMinted(recipient, tokenId, expirations[i]);
        }
    }

    // Owner-only function to extend a token's expiration
    function extendTokenExpiration(uint256 tokenId, uint256 daysToAdd) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");

        // Get current expiration
        uint256 currentExpiration = _tokenInfo[tokenId].expirationTimestamp;

        // If token has lifetime ownership (expirationTimestamp == 0), we shouldn't add time
        require(currentExpiration != 0, "Token has lifetime ownership");

        // Calculate the additional time in seconds
        uint256 additionalTime = daysToAdd * 1 days;

        // Update the expiration timestamp
        _tokenInfo[tokenId].expirationTimestamp = currentExpiration + additionalTime;

        emit TokenExpirationExtended(tokenId, _tokenInfo[tokenId].expirationTimestamp);
    }

    // Internal mint function
    function _mintToken(
        address to,
        uint256 tokenId,
        string memory name,
        string memory url,
        string memory icon,
        string memory description,
        uint256 expirationTimestamp
    ) internal {
        require(bytes(description).length <= 60, "Description too long"); // FIXME: this should be in the previous minting methods, not fail here
        _safeMint(to, 1);  // Mint 1 ERC721A token
        _tokenInfo[tokenId] = TokenInfo({
            url: url,
            name: name,
            icon: icon,
            description: description,
            expirationTimestamp: expirationTimestamp
        });
        current_total++;
    }

    // Override _burn function to handle TokenInfo cleanup and current_total
    function _burn(uint256 tokenId, bool approvalCheck) internal override {
        super._burn(tokenId, approvalCheck);
        delete _tokenInfo[tokenId];
        current_total--;
    }

    // Override transfer functions to prevent transferring expired tokens
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override {
        super._beforeTokenTransfers(from, to, startTokenId, quantity);

        for (uint256 i = startTokenId; i < startTokenId + quantity; i++) {
            require(!_isTokenExpired(i), "Cannot transfer expired token");
        }
    }

    // Check if a token is expired
    function _isTokenExpired(uint256 tokenId) internal view returns (bool) {
        uint256 expiration = _tokenInfo[tokenId].expirationTimestamp;
        return expiration != 0 && block.timestamp >= expiration;
    }

    // Token owner can renew their token
    function renewToken(uint256 tokenId, bool extendToLifetime) external payable whenNotPaused {

        // FIXME: this should instead let them extend to any length, but pay the appropriate fee (renewal_fee * number of years they want to extend)

        require(_exists(tokenId), "Token does not exist");
        require(ownerOf(tokenId) == msg.sender, "Not the token owner");

        uint256 fee = extendToLifetime ? lifetime_fee : renewalFee;
        require(msg.value >= fee, "Insufficient ETH for renewal");

        if (extendToLifetime) {
            _tokenInfo[tokenId].expirationTimestamp = 0;
        } else {
            uint256 extension = _getTokenExpirationDuration(tokenId);
            _tokenInfo[tokenId].expirationTimestamp = block.timestamp + extension;
        }

        emit TokenRenewed(msg.sender, tokenId, _tokenInfo[tokenId].expirationTimestamp);
    }

    // Get the expiration duration based on token type
    function _getTokenExpirationDuration(uint256 tokenId) internal view returns (uint256) {
        // FIXME: this is completely wrong - it should be based on the last renewal number of years

        // Assuming tokens retain their original expiration durations upon renewal
        if (tokenId < basic_max) {
            return basicExpiration;
        } else if (tokenId < random_max) {
            return randomExpiration;
        } else {
            return customExpiration;
        }
    }

    // Owner can reclaim expired tokens
    function reclaimExpiredToken(uint256 tokenId) external onlyOwner {
        require(_exists(tokenId), "Token does not exist");
        require(_isTokenExpired(tokenId), "Token is not expired");

        _burn(tokenId);
        delete _tokenInfo[tokenId];
        current_total--;

        emit TokenReclaimed(tokenId);
    }

    // Token owner can update token data if valid
    function updateTokenInfo(
        uint256 tokenId,
        string memory newUrl,
        string memory newName,
        string memory newDescription
    ) external onlyValidToken(tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not the token owner");
        require(bytes(newDescription).length <= 60, "Description too long");

        TokenInfo storage info = _tokenInfo[tokenId];
        info.url = newUrl;
        info.name = newName;
        info.description = newDescription;
    }

    // Individual update functions
    function updateTokenUrl(uint256 tokenId, string memory newUrl) external onlyValidToken(tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not the token owner");
        _tokenInfo[tokenId].url = newUrl;
    }

    function updateTokenName(uint256 tokenId, string memory newName) external onlyValidToken(tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not the token owner");
        _tokenInfo[tokenId].name = newName;
    }

    function updateTokenDescription(uint256 tokenId, string memory newDescription) external onlyValidToken(tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not the token owner");
        require(bytes(newDescription).length <= 60, "Description too long");
        _tokenInfo[tokenId].description = newDescription;
    }

    // Publicly retrieve token information by ID
    function getTokenInfo(uint256 tokenId)
        external
        view
        returns (
            string memory name,
            string memory url,
            string memory icon,
            string memory description,
            uint256 expirationTimestamp
        )
    {
        // FIXME: do not return info if expired
        require(_exists(tokenId), "Token does not exist");
        TokenInfo memory info = _tokenInfo[tokenId];
        return (info.name, info.url, info.icon, info.description, info.expirationTimestamp);
    }

    // Generate a basic token ID matching the pattern 0b1010100????11????00????11????0010101
    function _generateBasicTokenId() internal view returns (uint256) {
        uint256 tokenId = 0;

        // Set fixed bits
        tokenId |= (1 << 35); // Bit 35
        // Bit 34 is 0
        tokenId |= (1 << 33); // Bit 33
        // Bit 32 is 0
        tokenId |= (1 << 31); // Bit 31
        // Bits 30 and 29 are 0

        // Generate random bits for '?'
        uint256 randomBits = uint256(
            keccak256(abi.encodePacked(block.timestamp, msg.sender, current_total))
        );

        // Bits 28-25 (variable)
        uint256 chunk1 = (randomBits >> 0) & 0xF; // 4 bits
        tokenId |= chunk1 << 25;

        // Bits 24-23 (fixed to '11')
        tokenId |= (1 << 24);
        tokenId |= (1 << 23);

        // Bits 22-19 (variable)
        uint256 chunk2 = (randomBits >> 4) & 0xF;
        tokenId |= chunk2 << 19;

        // Bits 18-17 (fixed to '00')
        // Already zero

        // Bits 16-13 (variable)
        uint256 chunk3 = (randomBits >> 8) & 0xF;
        tokenId |= chunk3 << 13;

        // Bits 12-11 (fixed to '11')
        tokenId |= (1 << 12);
        tokenId |= (1 << 11);

        // Bits 10-7 (variable)
        uint256 chunk4 = (randomBits >> 12) & 0xF;
        tokenId |= chunk4 << 7;

        // Bits 6-5 (fixed to '00')
        // Already zero

        // Bits 4-0 (fixed to '10101')
        tokenId |= (1 << 4);
        tokenId |= (1 << 2);
        tokenId |= (1 << 0);

        return tokenId;
    }

    // Generate a random token ID (any 36-bit number)
    function _generateRandomTokenId() internal view returns (uint256) {
        uint256 randomId = uint256(
            keccak256(abi.encodePacked(block.timestamp, msg.sender, current_total))
        ) % MAX_SUPPLY;
        while (_exists(randomId)) {
            randomId = (randomId + 1) % MAX_SUPPLY;
        }
        return randomId;
    }

    // Set prices and fees (owner only)
    function setBasicPrice(uint256 newBasicPrice) external onlyOwner {
        basic_price = newBasicPrice;
    }

    function setRandomPrice(uint256 newRandomPrice) external onlyOwner {
        random_price = newRandomPrice;
    }

    function setCustomPrice(uint256 newCustomPrice) external onlyOwner {
        custom_price = newCustomPrice;
    }

    function setLifetimeFee(uint256 newFee) external onlyOwner {
        lifetime_fee = newFee;
    }

    function setRenewalFee(uint256 newFee) external onlyOwner {
        renewalFee = newFee;
    }

    // Set expiration durations (owner only)
    function setBasicExpiration(uint256 duration) external onlyOwner {
        basicExpiration = duration;
    }

    function setRandomExpiration(uint256 duration) external onlyOwner {
        randomExpiration = duration;
    }

    function setCustomExpiration(uint256 duration) external onlyOwner {
        customExpiration = duration;
    }

    // Set max supplies (owner only)
    function setBasicMax(uint newBasicMax) external onlyOwner {
        basic_max = newBasicMax;
    }

    function setRandomMax(uint newRandomMax) external onlyOwner {
        random_max = newRandomMax;
    }

    // Set withdrawal address (owner only)
    function setWithdrawalAddress(address newAddress) external onlyOwner {
        require(newAddress != address(0), "Invalid address");
        withdrawalAddress = newAddress;
    }

    // Set base URI for metadata (owner only)
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    // Override baseURI function
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // Override tokenURI to provide metadata URL
    function tokenURI(uint256 tokenId) public view override(ERC721A, IERC721A) returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        string memory base = _baseURI();
        return bytes(base).length > 0 ? string(abi.encodePacked(base, Strings.toString(tokenId))) : "";
    }

    // Pausable functions (owner only)
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Withdraw function for contract owner
    function withdraw() external onlyOwner nonReentrant {
        uint _balance = address(this).balance;
        payable(withdrawalAddress).transfer(_balance);
    }

    // Receive and fallback functions to accept ETH
    receive() external payable {}

    fallback() external payable {}
}
