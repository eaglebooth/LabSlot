# LabSlot

LabSlot lets a facility operator allocate an equipment slot only after GenLayer validators establish that a different wallet's revealed experiment protocol semantically satisfies the exact policy revision frozen for that booking round.

## Scope

| Demonstrated | Not claimed |
|---|---|
| Sender-authenticated policy and protocol declarations | Physical experiment completion or safety |
| Commit/reveal request binding | Researcher credentials or asset ownership |
| Independent semantic qualification | Third-party laboratory certification |
| Deterministic earliest-compatible allocation | GEN escrow or economic settlement |

Markdown and fixture files are replay aids only. They never grant authority. Operational authority comes from `message.sender`; the contract binds the operator, researcher, facility, round, request, policy revision and exact protocol commitment.

## Why GenLayer

Natural-language facility rules contain limits, exclusions, supervision duties, cleanup requirements and exceptions that cannot be safely reduced to a fixed `if/else` parser. A leader proposes exact missing/conflicting clause IDs. Validators independently re-read the same on-chain declarations and can falsify a plausible but incorrect proposal. Deterministic code alone selects the earliest compatible request.

## Lifecycle

```text
operator register_facility
→ operator open_round (freezes policy revision)
→ researcher commit_request
→ same researcher reveal_request
→ operator close_round
→ any wallet assess_request for each reveal
→ any wallet mark_no_reveal when needed
→ any wallet clear_round
→ ALLOCATED or NO_MATCH
```

Recovery paths:

- Researcher can withdraw while intake is open.
- Operator can cancel an open round.
- Any wallet can mark an unrevealed commitment after close.
- Assessment and clearing are permissionless after close.
- There is no custody in v1, so an abandoned round cannot trap user funds.

## Roles

- Deployer: deploys code only; the constructor grants no owner or operator role.
- Facility operator: any wallet registering its own facility namespace.
- Researcher: a different wallet committing and revealing a request.
- Reviewer/keeper: any wallet triggering assessment or final clearing.

Reviewers can create their own facility with one wallet and submit a request using a second account in MetaMask. No hard-coded test address is required.

## Local verification

```powershell
python -m pytest -q -p no:cacheprovider
python -X utf8 -m genvm_linter.cli check contracts\lab_slot.py
npm ci
npm run lint
npm run build
```

## Frontend

The verified StudioNet deployment is configured locally as:

```text
NEXT_PUBLIC_CONTRACT_ADDRESS=0x4ccED926c9b2B9DE080cFAAFA85585153daCf88A
```

The frontend waits for `FINALIZED`, checks consensus/execution fields and re-reads facility, round and request state before displaying `VERIFIED`.

## Reviewer quick path

1. Read [proof model](docs/PROOF_MODEL.md) and [threat model](docs/THREAT_MODEL.md).
2. Run the local commands above.
3. Inspect [test resources](docs/TEST_RESOURCE_MANIFEST.md).
4. Confirm the active deployment in `deployments/studionet.json` after it is populated.
5. Replay the two-wallet lifecycle and one negative commitment mismatch.
6. Compare transactions with [live evidence](docs/LIVE_STUDIONET_EVIDENCE.md).

## Current readiness

The contract schema and version were read from StudioNet and a fresh two-wallet lifecycle plus two rejection controls completed on 2026-09-28. See `docs/LIVE_STUDIONET_EVIDENCE.md` for direct explorer links and authoritative readbacks. A hosted frontend URL and repository commit remain separate publication gates.

