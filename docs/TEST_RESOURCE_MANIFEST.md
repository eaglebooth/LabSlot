# Test resource manifest

These files are deterministic replay inputs, not authority. In live use, authority comes from the wallet that submits the exact text on-chain.

| Resource | On-chain authority | Purpose | Digest rule | Expected result |
|---|---|---|---|---|
| `FACILITY_POLICY.txt` | facility operator sender | policy revision 1 | contract hashes stored text | policy snapshot |
| `COMPATIBLE_PROTOCOL.txt` | researcher sender | positive control | commitment then reveal hash | `COMPATIBLE` |
| `CONFLICTING_PROTOCOL.txt` | researcher sender | over-speed negative control | commitment then reveal hash | `INCOMPATIBLE`, conflict `C1` |

Negative controls implemented in direct tests:

- operator attempts to request its own slot;
- correct commitment with different reveal bytes;
- same commitment replayed into a second round;
- same researcher wallet attempts a second request in one round;
- request cap exceeds the verifiable bound of six;
- prompt injection text routes to `UNRESOLVED`;
- leader proposes `COMPATIBLE`, validator independently finds `C1` conflict;
- unrevealed request is resolved permissionlessly;
- terminal/cancelled round rejects phase reuse.

