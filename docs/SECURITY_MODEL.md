# Security Model

## Security objective

For every successfully issued Qyoo `N`, its ERC-721 holder remains the owner until an ordinary holder-authorized transfer. Qyoo operations can stop future issuance, but no issuer, Minter owner, mint authority, or Registry admin can seize, burn, redirect, or appoint a controller for an existing holder's Qyoo.

The Registry is non-upgradeable. It exposes no burn function and records `_issued[N]` forever. The scanned 36-bit value is the ERC-721 token ID.

## Authority boundaries

| Actor | Can | Cannot |
| --- | --- | --- |
| Token owner | Transfer through standard ERC-721; set/revoke controller; change resolver | Mint an unused ID without an authorized issuer path |
| Current controller | Change the resolver | Transfer, approve, change owner, appoint controllers, stop owner revocation |
| ERC-721 approved operator | Transfer according to ERC-721 approval | Change resolver or controller merely because of ERC-721 approval |
| Mint authority / Minter | Mint a previously unused in-range ID while Registry minting is active | Mint twice, overwrite, transfer, burn, change resolver/controller on an existing token |
| Registry admin | Add/revoke future mint authorities; pause new issuance | Seize, redirect, burn, or pause existing-holder operations |
| Minter owner | Set future prices/version, signer, treasury, and Minter pause; withdraw proceeds | Control existing Registry tokens |
| Voucher signer | Authorize an exact future ID/recipient/tier/price/resolver hash/nonce/deadline | Redeem without the recipient transaction/payment; affect an existing token |

Tests exercise each denied path from the Registry admin, mint authority, Minter owner, controller, expired controller, approved operator, and unrelated attacker.

## Failure analysis

### Issuer key compromise

A compromised EIP-712 authorizer can sign vouchers for unused IDs, including custom IDs, at the currently configured price/version. Vouchers are bound to one Minter, chain, recipient, resolver hash, nonce, and deadline. The Registry admin can revoke or pause the Minter; the Minter owner can rotate the authorizer. Already-minted ownership and holder resolver control remain intact.

Operational launch should put issuer keys in an auditable signing service/HSM and monitor `VoucherRedeemed` against issuance records. Multisig/succession governance is deliberately deferred.

### Voucher replay

Each recipient nonce can be consumed once. Redemption marks it used before the external Registry call; a failed Registry mint reverts the nonce write. EIP-712 domain separation binds signatures to `QyooMinter`, version `1`, the current chain ID, and the deployed Minter address. Replay on another chain, another Minter, for another recipient, after expiry, with another resolver, or after a pricing-version change fails.

### Malicious controller

A controller can redirect content while delegated. It cannot transfer or approve the token, replace itself, or block owner action. The owner can revoke it at any time. An ownership transfer clears it atomically. If a controller update and revocation race in the mempool, transaction ordering determines the temporary resolver, but the owner can always revoke and set a final resolver; after transfer the old controller has no authority.

### Compromised Minter

An authorized Minter can create unused valid IDs. It cannot pass the Registry's permanent `_issued` check or holder/controller authorization. Revoking that Minter or pausing Registry minting stops further damage. Existing holders remain intact. A replacement Minter can be authorized later.

### Registry admin compromise

The admin can authorize a malicious minter and therefore compromise future allocation of unused IDs. It can also pause all new issuance. There is no proxy, privileged transfer, resolver override, controller override, burn, or holder-operation pause. Existing holders remain intact and can transfer/change resolution even while minting is paused.

### Resolver takeover

The on-chain pointer is authoritative, but content behind an HTTPS domain or mutable IPFS naming layer can still be compromised. The holder/controller can move to a new resolver. Independent clients can read `resolverOf` directly and follow supported URI schemes without Qyoo infrastructure.

v1 intentionally omits a manifest hash: mutable experiences are a core use case, and a hash without a specified manifest-fetch/content-integrity protocol would create false assurance. Immutable content can use a content-addressed URI such as IPFS. A later optional hash extension must define its exact semantics outside this immutable Registry.

### Transfer races and approvals

Transfers use OpenZeppelin ERC-721 authorization. Standard approval front-running considerations apply: owners should revoke approvals before an adversarial operator can consume them. Protocol controllers are separate from ERC-721 approvals. Any actual owner change clears the controller in the same transaction. Resolver state follows the token and remains changeable by the new owner.

### Reentrancy and payments

Minter redemption and withdrawal are `nonReentrant`. Redemption validates signature/payment, consumes the nonce, then calls the Registry. Any Registry failure reverts all effects and payment. Withdrawal snapshots the balance, calls only the configured revenue recipient, and reverts without losing funds if the receiver rejects ETH.

Registry minting commits `_issued`, owner, and initial resolver events before invoking an ERC-721 receiver callback. A contract recipient may legitimately update its own resolver during that callback; its later event remains correctly ordered for indexers. A rejected callback reverts the entire mint.

### ID reuse

No public or administrative burn path exists. `_issued[N]` is set before mint completion and is never cleared. Successful mint of `N` makes all future mint attempts for `N` revert. Even a future internal change would need to preserve this tombstone invariant; the deployed v1 bytecode itself is not upgradeable.

### Chain replay and forks

Voucher domains include chain ID and Minter address. A signature for one chain/deployment is invalid elsewhere. A contentious Ethereum fork can still duplicate all pre-fork state; deciding which chain remains canonical is a social/protocol governance event, not solvable by signature domain separation alone. Clients must use the published canonical Ethereum deployment and adequate finality.

## Residual risks and pre-deployment work

- Obtain independent Solidity/security review before any public deployment.
- Select multisig and operational key custody for Registry admin, Minter owner, authorizer, and treasury.
- Specify resolver URI client rules, HTTPS/IPFS trust indicators, and malicious-content handling.
- Decide deployment chain economics and finality after gas/L2 review.
- Add production monitoring for mint-authority, price, signer, resolver, and transfer events.
- The local JavaScript test stack has transitive Mocha development-only advisories. It is not linked into deployed bytecode; keep dependencies monitored and update when upstream fixes ship.
