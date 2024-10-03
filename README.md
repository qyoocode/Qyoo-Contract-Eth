# Qyoo NFT Smart Contract

## Table of Contents

- [Introduction](#introduction)
- [Contract Overview](#contract-overview)
  - [Key Features](#key-features)
  - [Token Types](#token-types)
- [Contract Details](#contract-details)
  - [Dependencies](#dependencies)
  - [State Variables](#state-variables)
  - [Structs](#structs)
  - [Events](#events)
  - [Modifiers](#modifiers)
- [Functions](#functions)
  - [Minting Functions](#minting-functions)
  - [Token Management Functions](#token-management-functions)
  - [Administrative Functions](#administrative-functions)
  - [Utility Functions](#utility-functions)
- [Usage Instructions](#usage-instructions)
  - [Prerequisites](#prerequisites)
  - [Compilation](#compilation)
  - [Deployment](#deployment)
  - [Interacting with the Contract](#interacting-with-the-contract)
- [Migration Plan](#migration-plan)
- [Security Considerations](#security-considerations)
- [License](#license)

## Introduction

The **Qyoo NFT Smart Contract** is a Solidity-based smart contract that implements an ERC721A token with extended functionalities tailored for the Qyoo platform. The contract allows users to mint unique NFTs that correspond to scannable codes, enabling dynamic content sharing and interaction through the Qyoo app.

This document provides a detailed technical overview of the contract, its functionalities, and instructions on how to deploy and interact with it. It is intended for developers who wish to understand the contract's inner workings or contribute to its development.

## Contract Overview

The Qyoo contract is built on the ERC721A standard for efficient batch minting and includes several custom features to support the Qyoo ecosystem.

### Key Features

- **Token Minting**: Supports minting of basic, random, and custom tokens.
- **Token Expiration**: Tokens have expiration dates, with options for lifetime ownership.
- **Token Management**: Owners can update token metadata and renew expired tokens.
- **Burn Functionality**: Tokens can be burned to facilitate future migrations.
- **Administrative Control**: Adjustable parameters for prices, expiration durations, and supply limits.
- **Security**: Incorporates OpenZeppelin's security best practices, including pausable functions and reentrancy guards.
- **Event Emission**: Emits events for key actions to facilitate off-chain monitoring.

### Token Types

1. **Basic Tokens**:
   - **Price**: `basic_price` (default 0.001 ETH)
   - **Expiration**: `basicExpiration` (default 1 year)
   - **Supply Limit**: `basic_max`

2. **Random Tokens**:
   - **Price**: `random_price` (default 0.01 ETH)
   - **Expiration**: `randomExpiration` (default 3 years)
   - **Supply Limit**: `random_max`

3. **Custom Tokens**:
   - **Price**: `custom_price` (default 0.1 ETH)
   - **Expiration**: `customExpiration` (default 5 years)
   - **Supply Limit**: Up to `MAX_SUPPLY`

4. **Lifetime Ownership**:
   - **Additional Fee**: `lifetime_fee` (default 1 ETH)
   - **Effect**: Token does not expire.

## Contract Details

### Dependencies

- **Solidity Version**: `^0.8.0`
- **OpenZeppelin Contracts**:
  - `Ownable.sol`: Access control for owner-only functions.
  - `Pausable.sol`: Allows contract pausing.
  - `ReentrancyGuard.sol`: Protects against reentrancy attacks.
- **ERC721A Contracts**:
  - `ERC721A.sol`: Efficient implementation of ERC721.
  - `ERC721ABurnable.sol`: Extension to allow token burning.

### State Variables

- **Constants**:
  - `MAX_SUPPLY`: Maximum number of tokens `(2**36) - 1`.
- **Supply Limits**:
  - `basic_max`: Max supply for basic tokens.
  - `random_max`: Max supply for random tokens.
- **Pricing**:
  - `basic_price`, `random_price`, `custom_price`: Prices for minting tokens.
  - `lifetime_fee`: Additional fee for lifetime ownership.
  - `renewalFee`: Fee for renewing expired tokens.
- **Expiration Durations**:
  - `basicExpiration`, `randomExpiration`, `customExpiration`: Durations for token expiration.
- **Addresses**:
  - `withdrawalAddress`: Address where contract funds can be withdrawn.
- **Token Info Mapping**:
  - `_tokenInfo`: Stores metadata and expiration for each token.
- **Total Supply**:
  - `total_supply`: Tracks the total number of tokens minted.

### Structs

- **TokenInfo**:
  - `url`: Associated URL for the token.
  - `name`: Name of the token.
  - `icon`: Icon URL or identifier.
  - `description`: Short description (max 60 characters).
  - `expirationTimestamp`: Timestamp when the token expires (0 if lifetime).

### Events

- `TokenMinted(address owner, uint256 tokenId, uint256 expirationTimestamp)`
- `TokenRenewed(address owner, uint256 tokenId, uint256 newExpirationTimestamp)`
- `TokenReclaimed(uint256 tokenId)`
- `TokenBurned(address owner, uint256 tokenId)`

### Modifiers

- `onlyValidToken(uint256 tokenId)`: Ensures the token exists and is not expired.
- `whenNotPaused`: Ensures the contract is not paused.

## Functions

### Minting Functions

#### `mintBasicToken(...)`

- **Description**: Mints a basic token with optional lifetime ownership.
- **Parameters**:
  - `name`, `url`, `icon`, `description`: Metadata for the token.
  - `isLifetime`: If `true`, token will not expire.
- **Requirements**:
  - Total supply must be less than `basic_max`.
  - Sender must pay at least `basic_price` (+ `lifetime_fee` if applicable).
- **Emits**: `TokenMinted`

#### `mintRandomToken(...)`

- **Description**: Mints a random token with optional lifetime ownership.
- **Parameters**: Same as `mintBasicToken`.
- **Requirements**:
  - Total supply must be less than `random_max`.
  - Sender must pay at least `random_price` (+ `lifetime_fee` if applicable).
- **Emits**: `TokenMinted`

#### `mintCustomToken(...)`

- **Description**: Mints a custom token with a specified ID.
- **Parameters**: Same as `mintBasicToken`, plus `customId`.
- **Requirements**:
  - `customId` must be less than or equal to `MAX_SUPPLY`.
  - Token ID must not already exist.
  - Sender must pay at least `custom_price` (+ `lifetime_fee` if applicable).
- **Emits**: `TokenMinted`

#### `ownerMintTokens(...)`

- **Description**: Owner-only function to batch mint tokens without payment.
- **Parameters**:
  - `recipient`: Address to receive the tokens.
  - Arrays of `tokenIds`, `names`, `urls`, `icons`, `descriptions`, `expirations`.
- **Requirements**:
  - Only callable by the contract owner.

### Token Management Functions

#### `updateTokenInfo(...)`

- **Description**: Updates all metadata fields of a token.
- **Parameters**: `tokenId`, `newUrl`, `newName`, `newIcon`, `newDescription`.
- **Requirements**:
  - Caller must be the owner of the token.
  - Token must be valid (not expired).
  - `newDescription` must be 60 characters or fewer.

#### Individual Update Functions

- **`updateTokenUrl(tokenId, newUrl)`**
- **`updateTokenName(tokenId, newName)`**
- **`updateTokenIcon(tokenId, newIcon)`**
- **`updateTokenDescription(tokenId, newDescription)`**

#### `renewToken(tokenId, extendToLifetime)`

- **Description**: Renews an expired token or extends it to lifetime ownership.
- **Parameters**:
  - `tokenId`: ID of the token to renew.
  - `extendToLifetime`: If `true`, sets expiration to 0.
- **Requirements**:
  - Caller must be the owner of the token.
  - Must pay at least `renewalFee` or `lifetime_fee`.
- **Emits**: `TokenRenewed`

#### `reclaimExpiredToken(tokenId)`

- **Description**: Allows the owner to reclaim and burn an expired token.
- **Requirements**:
  - Only callable by the contract owner.
  - Token must be expired.
- **Emits**: `TokenReclaimed`

#### `burn(tokenId)`

- **Description**: Allows token owners to burn their tokens.
- **Requirements**:
  - Caller must be the owner of the token.
- **Emits**: `Transfer` event to zero address.

### Administrative Functions

#### Price and Fee Adjustments

- **`setBasicPrice(newBasicPrice)`**
- **`setRandomPrice(newRandomPrice)`**
- **`setCustomPrice(newCustomPrice)`**
- **`setLifetimeFee(newFee)`**
- **`setRenewalFee(newFee)`**

#### Expiration Duration Adjustments

- **`setBasicExpiration(duration)`**
- **`setRandomExpiration(duration)`**
- **`setCustomExpiration(duration)`**

#### Supply Limit Adjustments

- **`setBasicMax(newBasicMax)`**
- **`setRandomMax(newRandomMax)`**

#### Withdrawal Functions

- **`setWithdrawalAddress(newAddress)`**
  - Sets a new address for withdrawals.
- **`withdraw()`**
  - Withdraws contract balance to `withdrawalAddress`.
- **Requirements**:
  - Only callable by the contract owner.

#### Pausable Functions

- **`pause()`**
- **`unpause()`**
- **Requirements**:
  - Only callable by the contract owner.

#### Metadata URI Management

- **`setBaseURI(baseURI)`**
  - Sets the base URI for token metadata.

### Utility Functions

#### Token Information Retrieval

- **`getTokenInfo(tokenId)`**
  - Returns `name`, `url`, `icon`, `description`, and `expirationTimestamp` of a token.

#### Token ID Generation

- **`_generateBasicTokenId()`**
  - Generates a token ID matching a specific pattern.
- **`_generateRandomTokenId()`**
  - Generates a random 36-bit token ID.

## Usage Instructions

### Prerequisites

- **Node.js** and **npm** installed.
- **Hardhat** or **Truffle** for contract compilation and deployment.
- **Solidity Compiler** version `^0.8.0`.
- **Ethereum Client** or access to a testnet/mainnet via a provider like Infura.

### Compilation

1. **Install Dependencies**:

   ```bash
   npm install @openzeppelin/contracts
   npm install erc721a
   ```

2. **Compile the Contract**:

   Using Hardhat:

   ```bash
   npx hardhat compile
   ```

   Using Truffle:

   ```bash
   truffle compile
   ```

### Deployment

1. **Configure Deployment Script**:

   Set up your deployment script with the appropriate network configuration.

2. **Deploy the Contract**:

   Using Hardhat:

   ```bash
   npx hardhat run scripts/deploy.js --network <network-name>
   ```

   Using Truffle:

   ```bash
   truffle migrate --network <network-name>
   ```

3. **Verify Deployment**:

   - Ensure the contract address is recorded.
   - Verify the contract on Etherscan if deploying to a public network.

### Interacting with the Contract

You can interact with the contract using scripts, a frontend application, or directly via the command line using tools like **Hardhat Console** or **Truffle Console**.

#### Example: Minting a Basic Token

```javascript
// Assuming you have a contract instance `qyooContract`

const name = "My Qyoo Token";
const url = "https://example.com";
const icon = "https://example.com/icon.png";
const description = "A sample Qyoo token";
const isLifetime = false;

// Calculate the required payment
const price = await qyooContract.basic_price();

const tx = await qyooContract.mintBasicToken(
  name,
  url,
  icon,
  description,
  isLifetime,
  { value: price }
);

await tx.wait();

console.log("Token minted successfully!");
```

#### Example: Updating Token Information

```javascript
const tokenId = 1; // Replace with your token ID
const newUrl = "https://newexample.com";

const tx = await qyooContract.updateTokenUrl(tokenId, newUrl);
await tx.wait();

console.log("Token URL updated successfully!");
```

#### Example: Renewing a Token

```javascript
const tokenId = 1; // Replace with your token ID
const extendToLifetime = true; // Set to false for standard renewal

// Calculate the required fee
const fee = extendToLifetime
  ? await qyooContract.lifetime_fee()
  : await qyooContract.renewalFee();

const tx = await qyooContract.renewToken(tokenId, extendToLifetime, {
  value: fee,
});

await tx.wait();

console.log("Token renewed successfully!");
```

## Migration Plan

To prepare for potential future upgrades or migrations (e.g., incorporating AR experiences or enhanced interactivity), the contract includes burn functionality. Token holders can burn their tokens, enabling them to mint equivalent tokens on a new contract with the same token IDs.

### Steps for Migration

1. **Token Holders Burn Tokens**:

   - Users call the `burn(tokenId)` function to destroy their tokens.
   - The `burn` function emits a `Transfer` event to the zero address.

2. **Deploy New Contract**:

   - Deploy a new contract (e.g., `QyooV2`) with the desired enhancements.

3. **Mint New Tokens**:

   - Users interact with the new contract to mint equivalent tokens.
   - The new contract verifies that the token was burned in the old contract.

4. **Data Migration**:

   - If necessary, migrate metadata or state associated with the tokens.

### Considerations

- **User Communication**: Provide clear instructions and support to users during the migration process.
- **Security**: Ensure the new contract is audited and secure.
- **Legal Compliance**: Update terms of service to include migration provisions.

## Security Considerations

- **Access Control**: Only the owner can call administrative functions.
- **Reentrancy Guard**: The `withdraw` function is protected against reentrancy attacks.
- **Pausable Contract**: The owner can pause the contract in case of emergencies.
- **Input Validation**: Functions validate inputs and enforce restrictions.
- **Token Expiration**: Expired tokens cannot be transferred or updated.
- **Burn Functionality**: Allows for secure token burning in preparation for migration.

## License

This project is licensed under the **BSD-3 Clause License**.

**Note**: This README provides an overview of the Qyoo NFT Smart Contract. For further details or contributions, please contact [github@qyoo.com](mailto:github@qyoo.com).