# Contract publication audit

Inspected public main `bc3c4c3e2dc12b5f4a82411f6011662417c677d9`.
Classification: experimental Registry/Minter with a verified Sepolia deployment.
Verdict: deployment-documentation correction is prepared; public release remains
blocked by license ambiguity and unexecuted fresh contract compile/test
verification. A dependency-maintenance candidate now passes the lockfile advisory
check; its install/runtime compatibility remains unverified. No Solidity source
or contract ABI declarations changed.

## Verified source behavior and coverage

Source review of `contracts/QyooRegistry.sol` establishes `tokenId <= 2**36-1`,
permanent `_issued` tombstones committed before receiver callbacks, no public burn,
owner-only controller appointment, owner/controller resolver changes, and controller
clearing only when ownership actually changes. The Registry admin manages future
issuance and cannot redirect existing tokens. Resolver strings are opaque, nonempty
and bounded to 256 bytes; clients must apply their own URI/content policy.

`contracts/QyooMinter.sol` uses EIP-712 chain/address domain separation, recipient,
resolver hash, tier, current price/version, deadline and per-recipient nonce binding.
Nonce effects precede the Registry interaction; failures revert them. Exact payment,
ECDSA recovery and `nonReentrant` guard redemption. Existing tests cover these rules,
wrong signers/domains, replay, transfers, paused issuance, receiver callbacks,
authority separation and rejected withdrawals. Source inspection and test presence
are not a claim that the tests were executed successfully in this audit.

## Findings

- HIGH — original development lockfile had six affected package entries
  (4 high/1 moderate/1 low). The maintenance candidate upgrades three transitive
  packages within their existing ranges and pairs Mocha12.0.3 with the official
  Hardhat Mocha4.0.0 plugin. Fresh lockfile audits now report zero vulnerabilities,
  including development dependencies. Full install/compile/test compatibility is
  still BLOCKED by the storage floor; do not promote this candidate before those
  checks pass. See [dependency triage](docs/DEPENDENCY_TRIAGE.md) for package,
  advisory, exposure and compatibility details. No Solidity/ABI change was made.
- HIGH — root `LICENSE` is BSD-3-Clause while Registry, Minter and test-contract
  SPDX headers say MIT. Preserved both pending owner confirmation of intended
  licensing; neither a new license grant nor a rewritten copyright was invented.
- MEDIUM — README falsely said no public deployment. Corrected using public
  Sourcify exact-match records, byte-identical local source and fresh read-only
  Sepolia `eth_getCode` comparison. See [SEPOLIA.md](docs/SEPOLIA.md). No Mainnet,
  operational minting-service, independent-audit or consumer-wallet claim is made.
- MEDIUM — no CI and Node floor too broad. Added compile/test/advisory CI and the
  documented Hardhat3 floor of 22.13.0. Hosted CI is not yet executed; npm audit
  passes against the candidate lockfile locally; hosted CI and runtime checks
  remain unexecuted.

## Commands and observed results

Executed from this audit worktree unless otherwise stated. Lockfile-only resolution
ran without installing a dependency tree. No chain transaction, deployment, key use
or fund movement occurred.

| Command | Result |
|---|---|
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm run compile` | FAIL, exit127: `hardhat: command not found`; contract compilation did not execute. |
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm test` | FAIL, exit127: `hardhat: command not found`; contract tests did not execute. |
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm audit --package-lock-only --ignore-scripts --cache .codex-work/npm-cache --json` | FAIL, exit1: six affected development-package entries (4high/1moderate/1low). No dependencies installed. |
| Matched maintenance candidate: `npm audit --package-lock-only --ignore-scripts --cache .codex-work/npm-cache --json` | PASS, exit0: zero affected entries including development dependencies. |
| Candidate: `npm audit --package-lock-only --omit=dev --ignore-scripts --cache .codex-work/npm-cache` | PASS, exit0: zero vulnerabilities. |
| `python3 scripts/verify-sepolia.py` | First FAIL: public RPC HTTP403; after descriptive User-Agent, PASS both sources and fresh runtime bytecodes. |
| `git diff --check` | PASS. |
| Fresh `npm ci`, local demo/gas, compile/test suite, GitHub CI | NOT RUN to completion: dependencies absent and storage-heavy installation paused below20GiB. |

Runtime check used the public endpoint `https://ethereum-sepolia-rpc.publicnode.com`.
Sourcify's independent compiler match supports deployed provenance; no independent
security review is implied. Existing older local build artifacts were not reused as
fresh results.

## Exposure, dependencies and ownership

Reviewed eight public-main reachable commits, all tracked source/configuration/test
files and the lockfile. Redacted public-history pattern scan found no private-key
or common credential-token matches. The hardcoded development helpers contain
local-only test values, not proof of production secrets. No private operational
configuration or deployment keys were copied into this branch.

Original BSD copyright retained. OpenZeppelin5.6.1 imports are package dependencies,
not copied implementations; its MIT attribution must accompany redistributed
bundles. Hardhat3.15.0, ethers6.17.0, OpenZeppelin5.6.1 and compiler configuration remain
unchanged. The maintenance candidate updates Mocha, its plugin and their lockfile
dependencies as recorded in the triage; full runtime verification is pending. Public tests
require only an ephemeral local chain; no deployment secret is needed.

Owner/legal actions: resolve SPDX/root-license inconsistency; review dependency
maintenance after its required runtime checks; separately decide any future
production network/custody policy. No current deployment or signing authority is granted by this audit.
