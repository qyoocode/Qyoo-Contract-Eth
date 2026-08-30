# Cross-Chain Notes

## Canonical rule

Ethereum is the canonical v1 ownership chain. For every raw 36-bit Qyoo ID `N`, there must never be two unrelated canonical owners on different chains.

The visual carrier receives no chain bits, the 36-bit namespace is not partitioned, and this repository does not allocate Cardano IDs or deploy a bridge.

## Requirements for any future bridge

A bridge design must preserve one ownership root. Acceptable models to evaluate later include locking/custody or authenticated state messaging from the canonical Ethereum Registry to a clearly non-canonical representation on another chain. A mirror must identify its source Registry, source chain, and source token ID and must not independently mint an already-canonical Qyoo.

Before implementation, a bridge specification must define:

- which Ethereum deployment and chain ID are canonical;
- finality and reorg handling;
- lock/mint, unlock/burn, and resolver synchronization state machines;
- how duplicate messages and replay are prevented;
- behavior during bridge pause or validator compromise;
- whether resolution reads Ethereum directly or verifies authenticated state;
- recovery that does not let bridge governance seize the canonical Ethereum token;
- explicit UI language distinguishing canonical ownership from a bridged representation.

Bridge compromise should, at worst, create a false representation off Ethereum. It must not grant authority over the canonical Registry token or resolver. If that guarantee cannot be made, the bridge should not launch.

No cross-chain code or deployment is included in vNext.
