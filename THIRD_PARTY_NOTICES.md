# License scope and third-party notices

Qyoo is maintained by Pushplay LLC. Current branding does not change historical
copyright ownership or existing grants.

## Qyoo repository code

The root [BSD-3-Clause license](LICENSE), including its original copyright notice,
remains unchanged. The existing `SPDX-License-Identifier: MIT` notices in
`contracts/QyooRegistry.sol`, `contracts/QyooMinter.sol`,
`contracts/test/RejectEtherReceiver.sol` and
`contracts/test/ResolverUpdatingReceiver.sol` remain unchanged as file-level
grants. Preserve those notices in redistributed copies; the root BSD license
does not remove them.

## OpenZeppelin Contracts

- Package: `@openzeppelin/contracts`, version **5.6.1**, pinned in the lockfile.
- Source: [OpenZeppelin Contracts v5.6.1](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/v5.6.1).
- License: MIT, copyright **2016–2026 Zeppelin Group Ltd**.
- Complete upstream notice: [LICENSES/OpenZeppelin-MIT.txt](LICENSES/OpenZeppelin-MIT.txt),
  copied from the [tagged upstream license](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.6.1/LICENSE).

The Solidity files import OpenZeppelin implementations rather than copying them
into this source tree. Preserve OpenZeppelin’s SPDX identifiers and include its
full MIT notice with redistributed implementations or compiled bundles. Other
installed development dependencies retain their own package licenses; this root
BSD license does not relicense them. `node_modules` and generated artifacts are
not part of the tracked source distribution.
