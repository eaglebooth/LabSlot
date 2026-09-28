# Threat model

## Attacker goals

- Obtain a slot with an incompatible protocol.
- Submit both sides of the evidence relationship.
- Reveal bytes different from the committed request.
- Replay a commitment in another round.
- Force a positive result with prompt injection.
- Clear a round before every request is resolved.

## Controls

- Operator and researcher must be distinct senders.
- Facility namespace is bound to the registering operator.
- Round snapshots policy text, digest and revision.
- Commitment binds operator, facility, round, request, researcher, protocol, duration and nonce.
- Commitment replay is globally indexed.
- Each researcher wallet can occupy at most one request slot per round.
- Leader output has a bounded three-verdict schema and exact clause IDs.
- Validator independently re-derives the semantic result.
- `COMPATIBLE` is invalid when missing/conflict arrays are non-empty.
- Only deterministic code chooses a winner.
- Clearing requires `resolved_count == request_count`.
- Terminal/cancelled rounds reject further phase transitions.

## Most dangerous false positive

An incompatible protocol is marked `COMPATIBLE` and receives the slot. The wrong-leader test demonstrates that a validator can reject a plausible positive result. A StudioNet consensus run remains required before submission readiness.

## Most dangerous false negative

A compatible protocol is unresolved. This does not grant a slot. v1 deliberately prefers a safe non-allocation over fabricating compatibility.

