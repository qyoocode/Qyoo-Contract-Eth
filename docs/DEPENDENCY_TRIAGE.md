# Development dependency advisory triage

Inspected 2026-10-18 from the isolated publication-audit branch. This is a
maintenance candidate, not a release or a contract security certification.

## Result and boundary

FACT: the original lockfile had six affected package entries (4 high, 1 moderate,
1 low). These are package-entry counts, not six distinct vulnerabilities: the
entries aggregate multiple advisories and Mocha is also counted for inherited
exposure. Fresh lockfile audits of the candidate report **zero vulnerabilities**,
both including development dependencies and with `--omit=dev`.

FACT: every affected entry is marked development-only. This repository has no
production JavaScript dependency tree or HTTP service. These packages run on a
developer/CI host; they do not run inside the deployed EVM contracts. A compromised
build/test host can still threaten its files or credentials, so development status
is not grounds to ignore the findings. OpenZeppelin is a Solidity compilation
input and remains unchanged at 5.6.1; `--omit=dev` alone does not certify a contract.

FACT: only package pins/lockfile and audit documentation change in this candidate.
Solidity, tests, Hardhat 3.15.0, ethers 6.17.0, OpenZeppelin 5.6.1, Solidity 0.8.26,
optimizer settings, network configuration and deployment scripts remain unchanged.
No public-chain signing, transaction, deployment, main-branch integration or push
occurred. Full tests deploy only ephemeral local fixture contracts.

**Local runtime validation passed.** The initial storage hold was resolved by a
separately approved offload. A fresh Node 22.23.3 install, compilation and complete
28-test suite passed; the installed tree reports zero vulnerabilities. Hosted CI
and an independent contract security review remain separate checks.

## Package severity and exploitability

The severity column is the original npm aggregate package-entry severity. The
exposure column is an inference from the checked source/configuration, bounded by
the stated attack prerequisites; it is not a proof of impossibility.

| Original package / parent | Severity / advisory mechanisms | Exposure in this repository | Candidate remedy |
|---|---|---|---|
| `adm-zip`0.6.0 / Hardhat | High aggregate: symlink overwrite, declared-size allocation and decompression-bomb DoS, SUID/SGID preservation, duplicate-entry ambiguity, asynchronous size-guard bypass and uncaught decompression error. | Build-host exposure requires a malicious ZIP or destination state. Hardhat's compiler downloader uses ZIP extraction for Windows compiler downloads after SHA256 validation against its compiler manifest. macOS/Linux compilation uses a native binary rather than that ZIP branch. Trusted download/manifest integrity reduces this particular route but is not a package-wide guarantee. | 0.6.1 within Hardhat's existing `^0.6.0` range. |
| `brace-expansion`2.1.4 / minimatch / Mocha | High aggregate: nested-brace/commalist recursion stack exhaustion; moderate quadratic rewrite CPU DoS. | Requires attacker-controlled glob patterns. Tests/configuration use repository-owned file selection; there is no user-facing glob endpoint. Untrusted CI configuration/patterns remain a host DoS concern. | Initially 2.1.7 within existing range; matched Mocha upgrade replaces that tree with 5.0.12. |
| `undici`6.28.0 / hardhat-utils | High aggregate: unrequested WebSocket subprotocol DoS; moderate compressed-WebSocket error DoS; low retry-interceptor response splitting. | Requires malicious server responses and the affected WebSocket/retry features. Hardhat uses HTTP tooling for compiler/network requests; this configuration defines no public remote network and no affected WebSocket/retry usage was found in project source. This does not prove all transitive callers unreachable. | 6.29.1 within existing `^6.28.0` range; newer nested tool utilities resolve 7.30.1. |
| `serialize-javascript`6.0.2 / Mocha | High RCE if attacker-controlled spoofed RegExp/Date objects are serialized and output evaluated; moderate crafted array-like object CPU DoS. | Mocha 11's buffered worker pool serializes options with `serialize-javascript`. The checked Hardhat configuration sets only a numeric timeout and does not request parallel Mocha workers. No untrusted options/object ingestion endpoint exists. A malicious test/configuration already executes JavaScript, but the dependency still needs updating. | 7.1.2 through supported Mocha 12 dependency range; avoids a forced transitive major override. |
| `diff`7.0.0 / Mocha | Low DoS in `parsePatch`/string `applyPatch` with crafted patch headers. Other diff APIs are unaffected by this advisory. | Mocha's base reporter uses diff generation for assertions. Project scripts/tests do not call `parsePatch` or `applyPatch`; no attacker-supplied patch parser endpoint was found. | 9.0.0 through supported Mocha 12 dependency range. |
| `mocha`11.8.0 / direct dev dependency | Moderate aggregate npm entry inherited from `diff`/`serialize-javascript`; not a separate direct Mocha advisory in this report. | Local/CI test runner exposure as above; no EVM runtime exposure. | Pin 12.0.3 together with official `@nomicfoundation/hardhat-mocha`4.0.0. |

## Primary advisory records

- adm-zip: [symlink overwrite](https://github.com/advisories/GHSA-vwc7-r8mq-g2x9),
  [allocation DoS](https://github.com/advisories/GHSA-7q85-xj36-vmfc),
  [zero-size bypass](https://github.com/advisories/GHSA-rcw4-f5rp-g42v),
  [SUID/SGID](https://github.com/advisories/GHSA-j5f4-cc29-5x44),
  [duplicate entries](https://github.com/advisories/GHSA-p634-w6r4-rjp2),
  [async guard bypass](https://github.com/advisories/GHSA-c6fg-446q-cg94),
  [async decompression error](https://github.com/advisories/GHSA-8238-w5pm-2374).
- brace-expansion: [quadratic rewrite](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr),
  [nested recursion](https://github.com/advisories/GHSA-qhr7-859c-m2p7),
  [comma recursion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p).
- undici: [compressed WebSocket](https://github.com/advisories/GHSA-3wwx-pv8p-q78v),
  [retry response splitting](https://github.com/advisories/GHSA-r53p-7pc4-xj5r),
  [unrequested subprotocol](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5).
- serialize-javascript: [code injection](https://github.com/advisories/GHSA-5c6j-r48x-rmvq),
  [CPU exhaustion](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v).
- diff: [patch parsing DoS](https://github.com/advisories/GHSA-73rr-hh4g-fpgx).

## Why the matched major upgrade

FACT: registry metadata for Hardhat Mocha 3.1.0 requires Mocha `^11.0.0`.
Mocha 11.8.0 is the latest 11 release currently listed and retains the affected
transitive ranges. Blind `npm audit fix --force`, Mocha 12 alone, `--legacy-peer-deps`
or forced transitive overrides would evade the supported peer relationship.

FACT: the official plugin 4.0.0
[changelog change](https://github.com/NomicFoundation/hardhat/commit/e50cc7336b104311519f6fae1f52f3a359016655)
changes the Mocha peer to `^12.0.0` while keeping Hardhat `^3.12.0`, which includes the
pinned 3.15.0. Its updated utility/error dependencies add nested utility versions;
they are not Solidity library changes. The candidate uses plugin 4.0.0 rather than
4.0.1 to avoid deliberately introducing the latter's direct utility 5 upgrade,
although a nested utility 5 is still resolved through the supported error package.
No override, audit suppression, compiler upgrade or Hardhat major change is used.

FACT: an in-memory comparison of the published plugin 3.1.0 and 4.0.0 tarballs
also found a source/runtime change in `merge-grep`: regex-literal flags now track
Mocha 12 and invalid include filters receive earlier validation. Other distributed
JavaScript files were identical. The project sets no grep/fgrep/invert/exclusion
filter, so the full-suite command avoids this changed optional filtering path.
This is another reason to run the supported pair together rather than force Mocha
12 underneath the old adapter. Tarballs were streamed in memory without retaining
duplicate dependency trees.

FACT: [Mocha 12 changelog](https://raw.githubusercontent.com/mochajs/mocha/v12.0.3/CHANGELOG.md)
includes ESM/package-export changes, CLI argument parser replacements, Node engine
floor changes, dependency majors, and reporter/hook behavior fixes. Mocha 12.0.3
requires Node `^20.19.0 || >=22.12.0`, compatible with this project's>=22.13.0 floor.
This project uses ESM tests, ordinary `describe`/`it`, programmatic Hardhat plugin
configuration and a numeric timeout; no Mocha CLI customization was found. Those
observations justified preparing the supported pair; the subsequent full local
suite now supplies runtime evidence.

## Verification

Initial lightweight checks:

1. Original `npm audit --package-lock-only --ignore-scripts --cache .codex-work/npm-cache --json`:
   exit1, six affected entries.
2. Three within-range updates with `npm update adm-zip brace-expansion undici --package-lock-only --ignore-scripts`:
   lockfile-only resolution succeeded; audit reduced to three affected entries.
3. `npm install --package-lock-only --ignore-scripts --save-dev --save-exact @nomicfoundation/hardhat-mocha@4.0.0 mocha@12.0.3`:
   resolution succeeded without peer bypass; no `node_modules` tree installed.
4. Candidate lockfile audit including dev: exit0, zero vulnerabilities; omit-dev
   audit: exit0, zero vulnerabilities. Repeated successfully under Node 22.23.3.
5. `npm ls --package-lock-only --all --json`: exit0, no dependency/peer problems.
   This validates the resolved graph, not installed module execution. No hosted
   workflow ran.

After explicit capacity clearance, the following commands ran under existing
Node 22.23.3/npm 10.9.9, with
`env PATH=/Users/jeffrey/.nvm/versions/node/v22.23.3/bin:/usr/bin:/bin`:

| Command | Result |
|---|---|
| `npm ci --ignore-scripts --cache .codex-work/npm-cache --no-fund` | Exit 0; 131 packages installed; zero vulnerabilities. |
| `npm run compile` | Exit 0; 4 Solidity files; solc0.8.26/cancun. |
| `npm test` | Exit 0; 28 passing (13 Minter, 3 protocol properties, 12 Registry); zero failing. |
| `npm audit --audit-level=high --cache .codex-work/npm-cache` | Exit 0; zero vulnerabilities including dev dependencies. |
| `npm ls --all --json` | Exit 0; installed dependency/peer graph valid. |
| `git diff --check` | Exit 0. |

The full suite exercises token bounds, tombstones, callbacks/reentrancy, authority,
transfers, voucher binding/replay, payment, pause and withdrawals. No project test,
Solidity source, compiler setting or operational script changed. No remote
signing/deployment helper was run. Local demo/gas and hosted CI were not run.
Generated artifact hashes and exact log hashes are recorded in the local
[validation manifest](../artifacts/publication-audit/validation.json); no bytecode
equivalence comparison with an old build is claimed.

## Storage and retained evidence

Beginning free space 20,861,936 KiB (~19.90 GiB), below 20 GiB. Initial scratch 2,460 KiB;
after lock-only metadata resolution 15,328 KiB (~12.6 MiB growth). No dependency install,
compiler download, build, test run, deletion or quarantine occurred in this phase.
Untracked ignored scratch retains audit JSON snapshots and registry size metadata
for reproducibility, not as deliverables or a replacement for checks.

Registry `dist.unpackedSize` metadata for 131 platform-compatible candidate entries
sums 134,470,838 bytes (~128 MiB; includes all analyzer binaries conservatively).
The lockfile phase ended 21,132,776KiB free (~20.15 GiB); no cleanup was performed
by this task. That thin margin was insufficient for proceeding safely.

After the separately approved offload, the runtime phase began 22,563,788KiB free
(21.52GiB) and ended 22,338,520KiB (21.30 GiB). Whole-volume growth was about 220MiB;
external activity can contribute. One retained dependency tree uses 164,840KiB,
scratch/npm cache 49,184KiB, generated artifacts 3,104KiB and build cache 8KiB.
Scratch grew 33,808KiB during runtime validation. The one predictable dependency
tree, cache, generated artifacts and small QA logs are retained for review/reuse;
no duplicate tree, compiler cache, deletion or quarantine was created here.
