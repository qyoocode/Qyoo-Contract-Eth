# Legacy Contract Audit

## Scope and provenance

This audit covers the Solidity experiment present at repository commit `58a0bb5d187f8e00b46f2602094e05fbd90952be` and its README, tests, deployment script, and Git history. There is no live state to migrate. The implementation is preserved in Git history; it is not a compatibility target for the vNext protocol.

The baseline did not compile in the checked-in configuration. Hardhat rejected an undefined Sepolia account before compilation, the contract referenced an undeclared `random_max`, and the checked-in test and Ignition files were unchanged `Lock` templates for a contract that did not exist.

## Legacy behavior

| Area | Observed behavior |
| --- | --- |
| ERC-721 | `ERC721A` plus public `ERC721ABurnable`, OpenZeppelin `Ownable`, `Pausable`, and `ReentrancyGuard`. |
| Carrier range | `MAX_SUPPLY = (2**36) - 1`; custom IDs used an inclusive upper-bound check. Random generation used modulo `MAX_SUPPLY`, so it never selected the inclusive maximum. Owner batch mint did not enforce the 36-bit limit. |
| Critical identity defect | `_mintToken(to, tokenId, ...)` called `_safeMint(to, 1)`. ERC721A therefore minted its next sequential token ID while Qyoo metadata was written under the requested/generated ID. `tokenId == scanned ID` was not guaranteed. |
| Mint products | Basic, pseudo-random, exact/custom, and owner-only batch minting. Basic generation imposed a bit pattern. Randomness used `block.timestamp`, caller, and a counter, then linearly searched collisions. |
| Historical prices | Basic `0.001 ETH`, random `0.01 ETH`, custom `0.1 ETH`; all accepted overpayment. These values are product evidence, not launch commitments. |
| Expiration | Basic one year, random three years, custom five years. A `1 ETH` surcharge made a token “lifetime”; a `0.005 ETH` fee renewed it. The admin could extend expirations. Expired tokens could not transfer. |
| Reclaim and burn | The Registry owner could reclaim expired tokens and holders inherited public burn. Reclaim called the overridden burn—which already deleted metadata and decremented supply—and then deleted/decremented again, causing underflow/revert in Solidity 0.8. Burn also enabled future ID reuse in the intended migration model. |
| Metadata | Full URL, name, icon, description, and expiration stored on-chain. A mutable global base URI changed ERC-721 metadata routing for every token. |
| Holder control | Current holder could update URL/name/description only while unexpired. There was no delegated controller role. |
| Pause/admin | Owner could change all prices, fees, expiration periods, supply limits, base URI, withdrawal destination, and pause mint/renew paths. Expiration independently disabled holder transfer/control. |
| Revenue | Funds accumulated in the contract. Owner withdrawal used Solidity `transfer` to a configurable address initialized to one hard-coded address. Empty/overpayment behavior was not explicit. |
| Migration | README proposed holder burn followed by equivalent minting in a future contract. No on-chain migration verification was implemented. |
| Tests | Only a generated Hardhat `Lock` template was present. It did not exercise Qyoo and referenced a missing contract. |
| Dependencies | Solidity `^0.8.20`, Hardhat `2.22.13`, toolbox `5.0.0`, OpenZeppelin `5.1.0`, ERC721A `4.3.0`, dotenv `16.4.5`. |

## Decision record

### Preserved

- ERC-721 interoperability and ordinary owner-authorized transfer.
- The exact 36-bit carrier namespace, now enforced for every mint.
- Lower-cost issuer-assigned and higher-cost buyer-chosen commercial tiers.
- Configurable future pricing and explicit revenue withdrawal.
- Events sufficient for off-chain indexing.
- The useful idea that a holder can change what a Qyoo resolves to.

### Redesigned

- One monolith became a small permanent `QyooRegistry` plus replaceable `QyooMinter`.
- The raw scanned value is now the actual ERC-721 token ID.
- Predictable on-chain “randomness” became issuer-selected, EIP-712-authorized exact issuance.
- Full CMS metadata became one explicit, token-specific resolver URI capped at 256 bytes.
- Holder-only URL updates became owner/controller resolver control.
- Global pausing became new-mint pausing only; existing holders retain control.
- Revenue transfer uses checks-effects-interactions, `call`, and reentrancy protection.

### Removed

- Ownership expiration, renewal fees, lifetime surcharge, reclaim, and transfer blocking.
- Public burn and the assumption that an ID may be reminted after destruction.
- Basic patterned-ID minting and the obsolete basic supply tier.
- On-chain title, icon, description, and experience/CMS storage.
- Shared mutable base/default resolver behavior.
- Public-network credentials/configuration and migration-by-burn documentation.

Official resolver hosting subscriptions are a future off-chain service concern. Their status must never affect Registry ownership.
