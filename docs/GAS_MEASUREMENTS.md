# Local Gas Measurements

Measured on 2026-08-30 using Hardhat's ephemeral L1 simulation, Solidity 0.8.26, Cancun EVM target, and optimizer enabled with 200 runs.

| Operation | Gas used |
| --- | ---: |
| Random-tier voucher redemption plus Registry mint | 175,317 |
| Custom-tier voucher redemption plus Registry mint | 175,408 |
| Controller update | 48,760 |
| Resolver update | 36,815 |
| ERC-721 transfer with controller clearing | 58,036 |

These are approximate development measurements, not fee quotes. Resolver byte length, zero/non-zero storage transitions, compiler revisions, and target chain pricing affect results. Reproduce with:

```sh
npm run gas
```

Clarity and holder safety take priority over small gas savings. These measurements are inputs to a later Mainnet-versus-L2 economic decision; no chain deployment occurred in this task.
