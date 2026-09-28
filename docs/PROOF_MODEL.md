# LabSlot proof model

## Claim

For one exact facility, equipment, policy revision, round and requester, the revealed protocol covers every mandatory policy requirement and contains no material conflict or disallowed exception.

## Epistemic boundary

LabSlot does not prove that an experiment was performed, that a researcher is professionally qualified, or that physical equipment is safe. It proves only semantic compatibility between two sender-authenticated on-chain declarations and reserves an on-chain slot.

## Authority map

| Fact | Authority | Binding |
|---|---|---|
| Facility and policy | facility operator wallet | sender + facility ID + policy revision + digest |
| Protocol and duration | researcher wallet | sender + commitment + reveal + request ID |
| Round and slot | contract state | operator + facility + round ID + policy revision |
| Semantic compatibility | independent GenLayer validator judgment | exact policy/request snapshot |
| Winner | deterministic contract logic | lowest request index among compatible requests |

Fixture files are not authority. They only reproduce bytes used in tests.

## Why this is not a clone

LabSlot is a bounded batch allocator, not an evidence registry or one-time capability gate. Multiple commit-reveal requests compete inside a round. Each request is independently qualified, while the winner is derived by deterministic interval allocation. Persistent state is a sequence of facility policy revisions, booking rounds and competing request slots rather than a verdict ledger.
