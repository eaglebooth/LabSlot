# Live StudioNet evidence

Status: **LIVE LIFECYCLE VERIFIED — 2026-09-28**

## Deployment

| Field | Value |
|---|---|
| Network | StudioNet |
| Chain ID | 61999 |
| Contract | [`0x4ccED926c9b2B9DE080cFAAFA85585153daCf88A`](https://explorer-studio.genlayer.com/address/0x4ccED926c9b2B9DE080cFAAFA85585153daCf88A) |
| Deploy transaction | Not supplied; the address was independently read before testing |
| Verified schema | `LabSlot` / `semantic-batch-scheduler-v1` / version `1` |
| Runner header | v0.2.16 / pinned dependency |

Pre-test authoritative readback returned zero facilities, rounds, requests and allocations. The test wallets were separate auxiliary wallets; the deployer did not perform an application role.

## Two-wallet lifecycle

Case: facility `lab-0928-b`, round `round-0928-b`, request `req-0928-b`.

| Step | Caller | Function | Transaction | Consensus/execution | Authoritative readback |
|---|---|---|---|---|---|
| Facility | operator `0xeb57…81f8` | `register_facility` | [`0x4a9b…811f`](https://explorer-studio.genlayer.com/tx/0x4a9bfb395e85985ecb7cfceb96f507e745647b0f487c5fa99ea39d79e8c9811f) | `MAJORITY_AGREE` / `SUCCESS` | Facility registered under sender namespace |
| Round | operator `0xeb57…81f8` | `open_round` | [`0x33a7…caa9`](https://explorer-studio.genlayer.com/tx/0x33a7f4446a25269c9f498e4295c0615aa0c45d2735b32567acf58b0bf091caa9) | `MAJORITY_AGREE` / `SUCCESS` | Frozen policy revision `1` |
| Commit | researcher `0x2da5…843f` | `commit_request` | [`0xe240…5653`](https://explorer-studio.genlayer.com/tx/0xe24015879b3757fa7fef26feaaff034bb75571427d7dfc8eef080f2861a15653) | `MAJORITY_AGREE` / `SUCCESS` | Request index `1` |
| Reveal | researcher `0x2da5…843f` | `reveal_request` | [`0x7e06…cf14`](https://explorer-studio.genlayer.com/tx/0x7e06c4501c68409f40af309eb79bb1e41ed07ce69f30808acafa42078b0bcf14) | `MAJORITY_AGREE` / `SUCCESS` | Protocol digest `2e620d…11c8` |
| Close | operator `0xeb57…81f8` | `close_round` | [`0x9abd…b481`](https://explorer-studio.genlayer.com/tx/0x9abdf444f67573217c7eb6c63aaa78b63f07b247d943e13a0ba27e15347db481) | `MAJORITY_AGREE` / `SUCCESS` | Round closed with one revealed request |
| Assess | researcher `0x2da5…843f` | `assess_request` | [`0x69c4…2e27`](https://explorer-studio.genlayer.com/tx/0x69c46f731911df450da6144a95be6ec040a7c4d8f18c0766ea582157a71f2e27) | `MAJORITY_AGREE` / `SUCCESS` | `COMPATIBLE`; no missing/conflicting clauses |
| Allocate | researcher `0x2da5…843f` | `clear_round` | [`0x8ff9…994b`](https://explorer-studio.genlayer.com/tx/0x8ff90c248e99e47023e67ee83337dac029c13d67d7ff9db65bcac21cf0ff994b) | `MAJORITY_AGREE` / `SUCCESS` | Round `ALLOCATED`; request `AWARDED` |

Final readback: winner request `req-0928-b`, winner researcher `0x2da5393d7bbb9a037dc3abb56dbbc5c150fc843f`, compatible/resolved/request counts `1/1/1`, and global allocated count `1`.

## Negative controls

| Control | Transaction | Expected and observed |
|---|---|---|
| Operator attempts to request its own slot | [`0x95bc…23e6`](https://explorer-studio.genlayer.com/tx/0x95bc773bb2a3a03356bba2c7df2c5daeb07681cc68a75a2e57b1fa7efde223e6) | `MAJORITY_AGREE` / execution `ERROR`; no request created |
| Researcher reveals with the wrong nonce | [`0x4535…1197`](https://explorer-studio.genlayer.com/tx/0x4535b607231ebbc1e4473e4b34ae707beab02eeaee8fc865195da9cb44c71197) | `MAJORITY_AGREE` / execution `ERROR`; valid commitment remained revealable |

The subsequent valid reveal and final request count of one demonstrate that both rejected calls left the relevant state usable and did not create a second request.

## Adversarial StudioNet audit

Audit case suffix: `0928-audit1`. Every accepted write below reached `FINALIZED`, `MAJORITY_AGREE`, leader execution `SUCCESS`, and then passed contract readback. Every rejected write reached consensus with leader execution `ERROR` and was not treated as success.

### Explicit policy conflict

The revealed protocol requested an over-speed run and omitted a material declaration. Assessment transaction [`0x06c5…f82f`](https://explorer-studio.genlayer.com/tx/0x06c5ae0ebbf628bcca4fc8274cf91f348f7df7df56c2acef5d4e96d00c80f82f) produced `INCOMPATIBLE`, conflict `C1`, missing `C2`. Clearing transaction [`0xd055…1b12`](https://explorer-studio.genlayer.com/tx/0xd0554810d887360c9c27336e16549837d9499ab2394f0a670cbef8c1af761b12) produced `NO_MATCH`, zero compatible requests and no winner.

### Prompt-injection payload

Assessment transaction [`0x50f0…76cd`](https://explorer-studio.genlayer.com/tx/0x50f0f880a42f64e59ce01b6228deb0817903d7e5f5df1e0a7c3c036fcd4176cd) treated the injected instruction as quoted data and returned `INCOMPATIBLE`, missing `C1,C2,C3,C4,C5`. Clearing transaction [`0x8248…a01d`](https://explorer-studio.genlayer.com/tx/0x8248bbe14b212c034e48ebbb2fa49aa5395229ada5292e76ab72b4c22995a01d) produced `NO_MATCH` with no winner.

### Guard and recovery controls

| Control | Transaction | Observed result |
|---|---|---|
| Request limit `7` | [`0x4c44…755d`](https://explorer-studio.genlayer.com/tx/0x4c4420b9e742ffbba10a235a8809273e8e53dbb184c6d09437d860b12340755d) | execution `ERROR` |
| Researcher tries operator-only close | [`0x20a3…8c9a`](https://explorer-studio.genlayer.com/tx/0x20a37b2df6bc6317ab6aa04330fba2f66b5af87f5b3079199404e85304f18c9a) | execution `ERROR` |
| Clear an already terminal round | [`0x010e…9015`](https://explorer-studio.genlayer.com/tx/0x010ed73aaa3fa0318a5d63d6fd3f485d95e6647df91d0d63089c08bc4c109015) | execution `ERROR` |
| Replay a globally used commitment | [`0x0be1…4209`](https://explorer-studio.genlayer.com/tx/0x0be18bce31d74bf59399c2cc00885cc44db56e121159e04c9aeb580de4bc4209) | execution `ERROR` |
| Resolve unrevealed request | [`0xca8b…9da2`](https://explorer-studio.genlayer.com/tx/0xca8b8077fffee8c8dabe9ade853db370426d3ed9d7b1983825f16817b6a09da2) | `NO_REVEAL` readback |
| Clear recovered round | [`0xefd7…4054`](https://explorer-studio.genlayer.com/tx/0xefd70baa00bcd9cbc16eb6e1166e3a08726214ab2501778b319be1e33a334054) | `NO_MATCH`, no winner |

Final global readback after the audit: `allocated=1`, `facilities=5`, `requests=4`, `rounds=5`. The only allocation remains the prior compatible happy path.

## Scope of the proof

- Authority is established by transaction senders and on-chain namespaces, not Markdown files.
- Fixture documents are only reproducible calldata.
- The semantic verdict qualifies declared protocol text against the frozen declared policy; it does not prove physical execution, identity, credentials, or laboratory safety.
- Success is claimed only where finality, consensus, leader execution and authoritative contract readback agree.
