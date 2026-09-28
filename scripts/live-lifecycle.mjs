import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const privateKey = (name) => {
  const value = required(name);
  return value.startsWith("0x") ? value : `0x${value}`;
};

const address = required("CONTRACT_ADDRESS");
if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new Error("Invalid CONTRACT_ADDRESS");

const operator = createAccount(privateKey("OPERATOR_SIGNER"));
const researcher = createAccount(privateKey("RESEARCHER_SIGNER"));
if (operator.address.toLowerCase() === researcher.address.toLowerCase()) {
  throw new Error("Operator and researcher must be different wallets");
}

const clients = {
  operator: createClient({ chain: studionet, account: operator }),
  researcher: createClient({ chain: studionet, account: researcher }),
};
const read = async (method, args = []) => JSON.parse(await clients.operator.readContract({
  address,
  functionName: method,
  args,
}));
const retry = async (operation, attempts = 5) => {
  let cause;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) {
      cause = error;
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw cause;
};
const transact = async (label, client, method, args, expectSuccess = true) => {
  const hash = await client.writeContract({ address, functionName: method, args, value: 0n });
  console.log(JSON.stringify({ label, hash, phase: "submitted" }));
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.FINALIZED,
    interval: 2500,
    retries: 360,
  });
  const tx = await retry(() => client.getTransaction({ hash }));
  const leader = tx.consensus_data?.leader_receipt?.[0];
  const result = tx.result_name ?? tx.resultName ?? receipt.resultName ?? "";
  const execution = leader?.execution_result ?? tx.txExecutionResultName ?? receipt.txExecutionResultName ?? "";
  const success = (tx.statusName ?? receipt.statusName) === "FINALIZED"
    && ["MAJORITY_AGREE", "AGREE"].includes(result)
    && ["SUCCESS", "FINISHED_WITH_RETURN"].includes(execution);
  console.log(JSON.stringify({ label, hash, result, execution, expected: expectSuccess ? "SUCCESS" : "REVERT", observed: success ? "SUCCESS" : "REVERT" }));
  if (success !== expectSuccess) throw new Error(`${label}: unexpected outcome`);
  return hash;
};

const suffix = required("CASE_SUFFIX");
const facilityId = `lab-${suffix}`;
const roundId = `round-${suffix}`;
const requestId = `req-${suffix}`;
const slotId = `slot-${suffix}`;
const nonce = `nonce-${suffix}`;
const policy = await readFile(new URL("../fixtures/FACILITY_POLICY.txt", import.meta.url), "utf8");
const protocol = await readFile(new URL("../fixtures/COMPATIBLE_PROTOCOL.txt", import.meta.url), "utf8");
const owner = operator.address.toLowerCase();
const researcherAddress = researcher.address.toLowerCase();

const version = await read("get_contract_version");
if (version.name !== "LabSlot" || version.schema !== "semantic-batch-scheduler-v1" || version.version !== 1) {
  throw new Error("Contract schema/version mismatch");
}
console.log(JSON.stringify({ address, operator: owner, researcher: researcherAddress, version, before: await read("get_stats") }, null, 2));

await transact("register_facility", clients.operator, "register_facility", [facilityId, "centrifuge-07", policy]);
await transact("open_round", clients.operator, "open_round", [facilityId, roundId, slotId, 2n]);

const invalidCommitment = "0".repeat(64);
await transact("operator_self_request_rejected", clients.operator, "commit_request", [owner, facilityId, roundId, "operator-self", invalidCommitment], false);

const commitmentPayload = {
  domain: "LABSLOT_REQUEST_COMMITMENT_V1",
  duration_minutes: 90,
  facility_id: facilityId,
  nonce,
  operator: owner,
  protocol_text: protocol.trim(),
  request_id: requestId,
  researcher: researcherAddress,
  round_id: roundId,
};
const commitment = createHash("sha256").update(JSON.stringify(commitmentPayload)).digest("hex");
await transact("commit_request", clients.researcher, "commit_request", [owner, facilityId, roundId, requestId, commitment]);
await transact("wrong_nonce_rejected", clients.researcher, "reveal_request", [owner, facilityId, roundId, requestId, protocol, 90n, `${nonce}-wrong`], false);
await transact("reveal_request", clients.researcher, "reveal_request", [owner, facilityId, roundId, requestId, protocol, 90n, nonce]);
await transact("close_round", clients.operator, "close_round", [facilityId, roundId]);
await transact("assess_request", clients.researcher, "assess_request", [owner, facilityId, roundId, requestId]);

const assessed = await read("get_request", [owner, facilityId, roundId, requestId]);
if (assessed.status !== "COMPATIBLE" || assessed.verdict !== "COMPATIBLE") {
  throw new Error(`Expected COMPATIBLE assessment, received ${assessed.status}/${assessed.verdict}`);
}
await transact("clear_round", clients.researcher, "clear_round", [owner, facilityId, roundId]);

const finalRound = await read("get_round", [owner, facilityId, roundId]);
const finalRequest = await read("get_request", [owner, facilityId, roundId, requestId]);
if (finalRound.status !== "ALLOCATED" || finalRound.winner_request_id !== requestId || finalRequest.status !== "AWARDED") {
  throw new Error("Final allocation invariant failed");
}
console.log(JSON.stringify({ finalRound, finalRequest, stats: await read("get_stats") }, null, 2));
