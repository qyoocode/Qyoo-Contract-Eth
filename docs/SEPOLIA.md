# Sepolia deployment provenance

Checked 2026-10-18 through public Sourcify records. The inspected public commit
is `bc3c4c3e2dc12b5f4a82411f6011662417c677d9`.

| Contract | Sepolia address | Public verification |
|---|---|---|
| Registry | `0x4A63452cEA17d6c955055A36540Cf67f1CdD5919` | [Sourcify](https://sourcify.dev/server/v2/contract/11155111/0x4A63452cEA17d6c955055A36540Cf67f1CdD5919?fields=all) |
| Minter | `0xAD1836742611DFB4fa5E01a3BC9A974d74d963B4` | [Sourcify](https://sourcify.dev/server/v2/contract/11155111/0xAD1836742611DFB4fa5E01a3BC9A974d74d963B4?fields=all) |

Both records report `creationMatch=exact_match` and `runtimeMatch=exact_match`.
Their `project/contracts/QyooRegistry.sol` and `QyooMinter.sol` contents match
this public commit byte-for-byte. Compiler: Solidity `0.8.26+commit.8a97fa7a`,
Cancun, optimizer enabled, 200 runs, OpenZeppelin Contracts `5.6.1`.

SHA-256 of original source files:

- Registry: `d4688a1c30343b8d7bac6b062ec58b08279f3b856d62c74a3bd6ebb7684f432b`
- Minter: `b134bb52b048b3c313dbdaabe29faea3b82b377a4dd4b8690135cb2066333a32`

Verification timestamps in the public records are 2026-08-30T21:46:01Z and
21:46:05Z. The read-only verification command is:

```sh
python3 scripts/verify-sepolia.py
```

It compares the public verification status and local contract sources, and
checks current runtime bytecode using a public Sepolia RPC. It never signs,
mints, sends transactions or reads credentials. Public services can fail or
change availability; errors must be reported rather than treated as a match.
This is source/deployment provenance, not an independent contract security audit.

An existing testnet deployment does not establish an active issuer, current
mint pricing, consumer distribution, Mainnet ownership policy or hosted-service
availability. Future transactions and deployments require separate authorization.
