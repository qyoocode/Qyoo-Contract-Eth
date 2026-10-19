# Contract publication audit

Inspected public main `bc3c4c3e2dc12b5f4a82411f6011662417c677d9`.
Classification: experimental Registry/Minter with a verified Sepolia deployment.
Verdict: deployment-documentation correction is prepared; public release remains
blocked by development-tool advisories, license ambiguity and unexecuted fresh
contract compile/test verification. No Solidity behavior or contract ABI changed.

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

- HIGH — development lockfile advisory gate FAIL: `npm audit --package-lock-only`
  reports six affected package entries: `adm-zip`, `brace-expansion`, `undici`,
  `serialize-javascript` (high), `mocha` (moderate), `diff` (low). All are development
  tooling. This does not establish an exploitable on-chain bug. Upgrading Mocha to
  the advertised fix is a major change; other paths have non-major fixes. A focused
  lockfile/toolchain update must be compiled/tested before adoption; no speculative
  untested dependency replacement was made. Examples of primary advisory records:
  [adm-zip](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9),
  [brace-expansion](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
  [undici](https://github.com/advisories/GHSA-3wwx-pv8p-q78v),
  [serialize-javascript](https://github.com/advisories/GHSA-5c6j-r48x-rmvq),
  [diff](https://github.com/advisories/GHSA-73rr-hh4g-fpgx).
- HIGH — root `LICENSE` is BSD-3-Clause while Registry, Minter and test-contract
  SPDX headers say MIT. Preserved both pending owner confirmation of intended
  licensing; neither a new license grant nor a rewritten copyright was invented.
- MEDIUM — README falsely said no public deployment. Corrected using public
  Sourcify exact-match records, byte-identical local source and fresh read-only
  Sepolia `eth_getCode` comparison. See [SEPOLIA.md](docs/SEPOLIA.md). No Mainnet,
  operational minting-service, independent-audit or consumer-wallet claim is made.
- MEDIUM — no CI and Node floor too broad. Added compile/test/advisory CI and the
  documented Hardhat3 floor of 22.13.0. Hosted CI is not yet executed; npm audit
  currently makes its advisory step fail by design until dependencies are repaired.

## Commands and observed results

Executed from this audit worktree unless otherwise stated. No dependency install,
chain transaction, deployment, key use or fund movement occurred.

| Command | Result |
|---|---|
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm run compile` | FAIL, exit127: `hardhat: command not found`; contract compilation did not execute. |
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm test` | FAIL, exit127: `hardhat: command not found`; contract tests did not execute. |
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm audit --package-lock-only --ignore-scripts --cache .codex-work/npm-cache --json` | FAIL, exit1: six affected development-package entries (4high/1moderate/1low). No dependencies installed. |
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
bundles. Hardhat, plugins, ethers, Mocha and transitive tools remain locked to the
original dependency versions pending the tested remediation above. Public tests
require only an ephemeral local chain; no deployment secret is needed.

Owner/legal actions: resolve SPDX/root-license inconsistency; approve/review tested
dependency maintenance; separately decide any future production network/custody
policy. No current deployment or signing authority is granted by this audit.
