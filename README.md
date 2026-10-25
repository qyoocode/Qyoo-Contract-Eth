# Qyoo Ethereum Registry and Minter

Qyoo is maintained by **Pushplay LLC**. This repository is an **experimental**
protocol, not a production-supported issuance service.

This experimental protocol can issue a permanent ERC-721 ownership record for a 36-bit Qyoo visual ID. Scanning alone does not mint or establish ownership.

The protocol rule is simple:

> Qyoo controls issuance. After minting, the holder controls the Qyoo.

If Qyoo operations disappear, existing holders can still prove ownership, use standard ERC-721 transfers, appoint/revoke a resolver controller, and change resolver pointers using ordinary Ethereum transactions. Only new issuance may stop.

The contracts at public commit `bc3c4c3e2dc12b5f4a82411f6011662417c677d9`
were deployed to Ethereum **Sepolia** (chain `11155111`). The
[deployment record](docs/SEPOLIA.md) distinguishes verified testnet contracts
from operational services. This repository does not establish a Mainnet
release, a public minting service or consumer wallet functionality.

## Architecture

```text
QyooMinter (replaceable commercial issuance)
    │ authorized for future unused IDs
    ▼
QyooRegistry (permanent ownership and resolution)
    │ read-only Ethereum calls
    ▼
independent scanners / resolvers / indexers
```

### QyooRegistry

`QyooRegistry` is a deliberately small, non-upgradeable ERC-721 contract.

- `tokenId == scanned raw 36-bit Qyoo ID`
- valid IDs are `0...68,719,476,735` (`2**36 - 1`)
- ownership never expires
- no burn function is exposed
- an ID that has been minted can never be minted again
- every mint writes an explicit token-specific resolver
- the holder can appoint or revoke one controller
- holder or controller can update the resolver
- ownership transfer clears the controller automatically
- standard ERC-721 approvals/transfers remain interoperable
- the Registry admin can manage future mint authorities and pause only new minting

There is no proxy or upgrade key. The Registry admin cannot transfer, burn, redirect, or appoint a controller for an existing holder's token. Minting can be paused without pausing transfer or resolution control.

### QyooMinter

`QyooMinter` is a replaceable business layer. It supports two configurable pricing tiers:

- **Random** — the Qyoo issuance service selects an unused valid ID.
- **Custom** — the buyer requests an exact unused valid ID.

Both use the same safe issuance mechanism: the service selects/approves the ID and signs an EIP-712 voucher; the named buyer submits the voucher and exact payment; the Minter verifies it and asks the Registry to mint that exact ID.

No timestamp, block hash, or predictable on-chain arithmetic is presented as randomness. “Random” describes the lower-cost product allocation made by the issuer, not a blockchain entropy claim.

Prices are constructor configuration and can change for future mints. A price update increments `pricingVersion`, invalidating older quotes. Historical `0.01 ETH` random and `0.1 ETH` custom values appear only as illustrative local demo inputs; they are not launch promises.

## Mint voucher v1

The EIP-712 domain is:

- name: `QyooMinter`
- version: `1`
- current chain ID
- deployed Minter address

The signed struct is:

```solidity
MintVoucher(
    uint256 tokenId,
    address recipient,
    uint8 tier,
    uint256 price,
    uint256 nonce,
    uint256 deadline,
    uint256 pricingVersion,
    bytes32 resolverHash
)
```

The voucher is non-transferable: `recipient` must submit it. Its nonce is one-use per recipient. It cannot be replayed on another chain or Minter, after its deadline, for another resolver, with another tier/price, after a pricing-version change, or for an already-issued ID. Payment must be exact; both underpayment and overpayment revert.

## Resolver protocol

The Registry stores one non-empty resolver string per token, limited to 256 UTF-8 bytes. It deliberately treats the value as an opaque URI/pointer so clients can evolve support for, for example:

- `https://...`
- `ipfs://...`
- a future contract/chain-aware URI scheme

The Registry does not assume `qyoo.com` is permanent and has no shared mutable default that can redirect existing Qyoos. A convenience default belongs in issuance software and becomes explicit token state at mint.

Full experience manifests, titles, icons, descriptions, analytics, personalization, and hosted-service subscriptions do not belong in the permanent Registry. Immutable content can use a content-addressed resolver. An optional manifest hash was omitted until its fetch and integrity semantics are specified.

Read current state without a transaction using:

- `ownerOf(tokenId)`
- `controllerOf(tokenId)`
- `resolverOf(tokenId)`
- `resolutionOf(tokenId)`
- `wasIssued(tokenId)`

ERC-721 `Transfer` plus `QyooMinted`, `ControllerChanged`, `ResolverChanged`, `MintAuthorityChanged`, and `MintingPauseChanged` events allow independent state indexing.

## Ownership versus official services

Qyoo ownership is permanent and has no annual fee. Future first-party resolver hosting may be sold as a separate service—potentially with included, annual, or lifetime hosting plans—but service expiry must never expire ownership. A holder can always select another resolver.

## Development

The prepared dependency-maintenance revision passed local compilation, all 28
tests and its recorded npm advisory check; see [AUDIT.md](AUDIT.md). Those are
dated results, not a current security guarantee. On 2026-10-24, compilation and
all 28 tests still pass, but CI’s advisory gate is blocked by
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) in
Hardhat’s Zod 3 dependency. No compatible patched Zod 3 release is available.
The separate `serialize-javascript` issue is patched within its existing range.
See [dependency triage](docs/DEPENDENCY_TRIAGE.md). Hosted CI must pass before merge.


Requirements:

- Node.js 22.13.0 or newer on a supported even-major release ([Hardhat support](https://hardhat.org/docs/reference/nodejs-support))
- npm

Install, compile, and test:

```sh
npm ci
npm run compile
npm test
```

The pinned development stack uses Hardhat 3.15.0, Solidity 0.8.26 targeting Cancun with optimizer runs set to 200, OpenZeppelin Contracts 5.6.1, ethers 6.17.0, and Mocha 12.0.3.

There are intentionally no public network entries, RPC secrets, or deployer keys in the Hardhat configuration.

## Local deployment and protocol demo

Deploy Registry and Minter on an ephemeral Hardhat chain:

```sh
npm run deploy:local
```

Run the full local scenario:

```sh
npm run demo
```

The demo:

1. deploys Registry and Minter;
2. authorizes the Minter;
3. issues one Random and one Custom Qyoo with signed vouchers;
4. appoints a controller;
5. changes the resolver through that controller;
6. revokes and reappoints the controller;
7. transfers the Qyoo, atomically clearing the controller;
8. proves the old controller is rejected;
9. lets the new owner change the resolver.

Measure the same core operations locally:

```sh
npm run gas
```

Current approximate measurements are recorded in [docs/GAS_MEASUREMENTS.md](docs/GAS_MEASUREMENTS.md).

## Tests and invariants

The suite covers:

- IDs `0`, `1`, representative values, `2**36 - 1`, and rejection of `2**36`;
- exact raw-ID/ERC-721 identity;
- permanent duplicate prevention over deterministic fuzzed IDs;
- standard ERC-721 owner/approval transfer authorization;
- resolver authority restricted to owner/current controller;
- owner revocation and controller clearing on transfer;
- Registry admin, mint authority, Minter owner, controller, stale controller, approved operator, and attacker abuse attempts;
- paused minting with uninterrupted existing-holder operations;
- Random and Custom voucher redemption;
- recipient, resolver, tier, price, pricing-version, deadline, nonce, chain, contract, and signer binding;
- exact payment, price changes, replay, invalid/already-used IDs, and failed withdrawals;
- safe-mint receiver callback event ordering for independent indexing.

See [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) for threats and residual work.

## Cross-chain policy

Ethereum is the canonical v1 chain. There are no separate Cardano IDs, no namespace partition, and no chain bits in the carrier. Any future bridge must represent Ethereum-rooted ownership rather than create a second unrelated canonical owner for Qyoo `N`.

See [docs/CROSS_CHAIN_NOTES.md](docs/CROSS_CHAIN_NOTES.md).

## Current limitations

- Sepolia testnet deployment is verified; no independent security audit or Mainnet deployment is established here.
- Admin, issuer, and treasury production custody/multisig policy is not selected.
- Resolver client URI rules and malicious-content UX remain to be specified.
- No official hosting subscription, marketplace, wallet UI, app RPC integration, bridge, tokenomics, or backend is implemented **in this repository**. Separate Qyoo products/services must be evaluated on their own evidence.
- Informational EIP-2981 royalties are not included; ordinary transfer does not depend on a first-party marketplace.

The legacy experiment and redesign decisions are documented in [docs/LEGACY_CONTRACT_AUDIT.md](docs/LEGACY_CONTRACT_AUDIT.md).

## License

Qyoo-owned code is covered by the repository’s [BSD-3-Clause license](LICENSE).
Existing MIT SPDX grants in the four Solidity files are preserved; the root
license does not revoke those file-level grants. Existing copyright notices and
third-party terms remain in force. This cleanup does not transfer historical
copyright ownership to Pushplay LLC or relicense third-party code.

OpenZeppelin Contracts 5.6.1 remains MIT-licensed. See
[third-party notices](THIRD_PARTY_NOTICES.md) and the retained
[OpenZeppelin MIT license](LICENSES/OpenZeppelin-MIT.txt). Include applicable
notices when redistributing source or compiled bundles.
