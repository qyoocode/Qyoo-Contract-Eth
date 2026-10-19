# Development dependency advisory triage

Inspected2026-10-18 from the isolated publication-audit branch. This is a
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
input and remains unchanged at5.6.1; `--omit=dev` alone does not certify a contract.

FACT: only package pins/lockfile and audit documentation change in this candidate.
Solidity, tests, Hardhat 3.15.0, ethers 6.17.0, OpenZeppelin 5.6.1, Solidity 0.8.26,
optimizer settings, network configuration and deployment scripts remain unchanged.
No signing, transaction, deployment, main-branch integration or push occurred.

**Runtime compatibility remains UNVERIFIED.** Storage below the mandatory 20 GiB
floor prevented installing the dependency tree and running compile/tests.
Zero audit findings are not a substitute for those checks.

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
pinned3.15.0. Its updated utility/error dependencies add nested utility versions;
they are not Solidity library changes. The candidate uses plugin 4.0.0 rather than
4.0.1 to avoid deliberately introducing the latter's direct utility5 upgrade,
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
observations justify preparing the supported pair, not claiming runtime success.

## Verification and required continuation

Executed lightweight checks:

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

After free space is compliant, use existing Node 22.23.3 at
`~/.nvm/versions/node/v22.23.3/bin` (executed version check succeeded), then:

```sh
export PATH="$HOME/.nvm/versions/node/v22.23.3/bin:$PATH"
npm ci --ignore-scripts --cache .codex-work/npm-cache
npm run compile
npm test
npm audit --audit-level=high --cache .codex-work/npm-cache
```

Run the entire existing Registry/Minter/property suite; inspect test counts and
failure names. It covers token bounds, tombstones, callbacks/reentrancy, authority,
transfers, voucher binding/replay, payment, pause and withdrawals. Compare generated
ABI/bytecode against the original pins/configuration where available without using
old artifacts as fresh results. Any failure blocks adopting the matched pair.
Do not run remote deployment or signing helpers as validation. Local demo/gas may
be a later ephemeral-chain smoke check after compile/full suite pass.

## Storage and retained evidence

Beginning free space20,861,936 KiB (~19.90 GiB), below 20 GiB. Initial scratch2,460 KiB;
after lock-only metadata resolution15,328 KiB (~12.6 MiB growth). No dependency install,
compiler download, build, test run, deletion or quarantine occurred in this phase.
Untracked ignored scratch retains audit JSON snapshots and registry size metadata
for reproducibility, not as deliverables or a replacement for checks.

Registry `dist.unpackedSize` metadata for 131 platform-compatible candidate entries
sums134,470,838 bytes (~128 MiB; includes all analyzer binaries conservatively).
Last free-space read21,132,776KiB (~20.15GiB), about0.25GiB above the
beginning whole-volume read; this change includes external activity and is not
attributable to this task. Scratch15,376KiB, growth12,916KiB (~12.6MiB).
No cleanup performed. Capacity clearance still pending because the margin is thin.

Budget 0.5 GiB additional peak for one dependency tree, cache, compiler and test
outputs; require a fresh capacity check and headroom above 20 GiB before starting.
Reuse this worktree's `node_modules`, `.codex-work/npm-cache`, Hardhat artifact/cache
locations and existing compiler cache. Do not create duplicate dependency trees.
