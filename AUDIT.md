# Contract publication audit

Inspected public main `bc3c4c3e2dc12b5f4a82411f6011662417c677d9`.
Classification: experimental Registry/Minter with a verified Sepolia deployment.
Verdict: dependency maintenance and deployment-documentation corrections are
prepared and locally validated. Public release remains blocked by the root/SPDX
license ambiguity. No Solidity source or contract ABI declarations changed.
Hosted CI and independent security review are not claimed.

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
authority separation and rejected withdrawals. Fresh Node 22 execution passed
all 28 tests (13 Minter, 3 protocol properties, 12 Registry).

## Findings

- HIGH — original development lockfile had six affected package entries
  (4 high/1 moderate/1 low). The maintenance candidate upgrades three transitive
  packages within their existing ranges and pairs Mocha 12.0.3 with the official
  Hardhat Mocha 4.0.0 plugin. Fresh lockfile audits now report zero vulnerabilities,
  including development dependencies. After explicit storage clearance, a fresh
  install, compile and full 28-test suite passed under Node 22.23.3. See [dependency triage](docs/DEPENDENCY_TRIAGE.md) for package,
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
  passes against the installed candidate locally; compile and all 28 tests also
  pass. Hosted CI remains unexecuted.

## Commands and observed results

Executed from this audit worktree unless otherwise stated. Lockfile-only resolution
initially ran without installing a dependency tree; after storage clearance,
`npm ci` installed the candidate and local tests used ephemeral fixture contracts.
No public-chain transaction, deployment, operational-key use or fund movement occurred.
Final runtime commands used `env PATH=/Users/jeffrey/.nvm/versions/node/v22.23.3/bin:/usr/bin:/bin`
(Node 22.23.3/npm 10.9.9). Earlier failures below are retained as baseline evidence.

| Command | Result |
|---|---|
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm run compile` | FAIL, exit127: `hardhat: command not found`; contract compilation did not execute. |
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm test` | FAIL, exit127: `hardhat: command not found`; contract tests did not execute. |
| `env PATH=/opt/homebrew/opt/node/bin:/usr/bin:/bin npm audit --package-lock-only --ignore-scripts --cache .codex-work/npm-cache --json` | FAIL, exit1: six affected development-package entries (4high/1moderate/1low). No dependencies installed. |
| Matched maintenance candidate: `npm audit --package-lock-only --ignore-scripts --cache .codex-work/npm-cache --json` | PASS, exit0: zero affected entries including development dependencies. |
| Candidate: `npm audit --package-lock-only --omit=dev --ignore-scripts --cache .codex-work/npm-cache` | PASS, exit0: zero vulnerabilities. |
| `python3 scripts/verify-sepolia.py` | First FAIL: public RPC HTTP403; after descriptive User-Agent, PASS both sources and fresh runtime bytecodes. |
| `git diff --check` | PASS. |
| `npm ci --ignore-scripts --cache .codex-work/npm-cache --no-fund` | PASS, exit0: 131 packages installed; zero vulnerabilities. |
| `npm run compile` (Node 22) | PASS, exit0: 4 Solidity files compiled with solc0.8.26/cancun. |
| `npm test` (Node 22) | PASS, exit0: 28 passing, zero failing. |
| `npm audit --audit-level=high --cache .codex-work/npm-cache` | PASS, exit0: zero vulnerabilities including development packages. |
| `npm ls --all --json` | PASS, exit0: installed dependency/peer tree valid. |
| Local demo/gas, hosted GitHub CI | NOT RUN; no claim for those additional checks. |

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
dependencies as recorded in the triage; local install/compile/tests pass. Public tests
require only an ephemeral local chain; no deployment secret is needed.

Owner/legal actions: resolve SPDX/root-license inconsistency; review dependency
maintenance; separately decide any future
production network/custody policy. No current deployment or signing authority is granted by this audit.


## Local validation evidence and storage

[Validation manifest](artifacts/publication-audit/validation.json) records exact
commands/results, package-lock hash, generated ABI/bytecode hashes and retained log
hashes. Logs and generated outputs are ignored local QA evidence, not a new source
bundle. No old artifact was used to claim this fresh compilation/test result; no
original-versus-candidate bytecode equivalence comparison is claimed.

After the separately approved storage offload, this validation phase began with
22,563,788 KiB free (21.52 GiB), ending 22,338,520 KiB (21.30 GiB), about 220 MiB
whole-volume reduction. Retained one dependency tree 164,840 KiB, reusable scratch/
npm cache 49,184 KiB, compiled artifacts 3,104 KiB and build cache 8 KiB. Scratch grew
33,808 KiB from this phase's 15,376 KiB baseline. No deletion/quarantine was performed
by the contract validation task. The reusable tree/cache and small QA logs remain
for review and future checks. No additional install tree or compiler cache created.
