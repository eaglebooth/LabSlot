"use client";

import { createClient } from "genlayer-js";
import { chain } from "./network";

export type Encodable = null | boolean | number | bigint | string | Uint8Array | Encodable[] | Map<string, Encodable> | { [key: string]: Encodable };
type Provider = {
  request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};
declare global { interface Window { ethereum?: Provider } }

type Receipt = { vote?: string; execution_result?: string; result?: string };
type Tx = {
  statusName?: string;
  resultName?: string;
  txExecutionResultName?: string;
  consensus_data?: { leader_receipt?: Receipt[]; validators?: Receipt[]; votes?: Receipt[] };
};
type Runtime = {
  readContract: (input: { address: `0x${string}`; functionName: string; args: Encodable[] }) => Promise<Encodable>;
  writeContract: (input: { address: `0x${string}`; functionName: string; args: Encodable[]; value: bigint }) => Promise<string>;
  waitForTransactionReceipt: (input: { hash: `0x${string}`; status: "FINALIZED"; interval: number; retries: number }) => Promise<Tx>;
  getTransaction: (input: { hash: `0x${string}` }) => Promise<Tx>;
};

export function validAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask is required");
  const chainId = `0x${chain.id.toString(16)}`;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch {
    // The GenLayer client may add or request the configured network during write.
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
  return accounts[0] || "";
}

export async function currentAccount(): Promise<string> {
  if (!window.ethereum) return "";
  const accounts = await window.ethereum.request({ method: "eth_accounts" }) as string[];
  return accounts[0] || "";
}

async function readRaw(address: string, method: string, args: Encodable[]): Promise<Encodable> {
  if (!validAddress(address)) throw new Error("Enter a valid deployed contract address");
  const client = createClient({ chain }) as unknown as Runtime;
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await client.readContract({ address: address as `0x${string}`, functionName: method, args });
    } catch (error) {
      last = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 650 * (attempt + 1)));
    }
  }
  throw last instanceof Error ? last : new Error("Studionet read failed");
}

export async function readJson(address: string, method: string, args: Encodable[] = []): Promise<Record<string, unknown>> {
  const raw = await readRaw(address, method, args);
  return JSON.parse(String(raw)) as Record<string, unknown>;
}

export async function writeContract(address: string, account: string, method: string, args: Encodable[], onStatus: (state: string, hash?: string) => void): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask is required");
  if (!validAddress(address)) throw new Error("Enter a valid contract address");
  if (!validAddress(account)) throw new Error("Connect a valid role wallet");
  const client = createClient({ chain, provider: window.ethereum, account: account as `0x${string}` }) as unknown as Runtime;
  onStatus("SIGNATURE");
  const hash = await client.writeContract({ address: address as `0x${string}`, functionName: method, args, value: BigInt(0) });
  onStatus("CONSENSUS", hash);
  await client.waitForTransactionReceipt({ hash: hash as `0x${string}`, status: "FINALIZED", interval: 2500, retries: 360 });
  let tx: Tx | undefined;
  let lastReadError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      tx = await client.getTransaction({ hash: hash as `0x${string}` });
      break;
    } catch (cause) {
      lastReadError = cause;
      if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  if (!tx) throw lastReadError instanceof Error ? lastReadError : new Error("Finalized transaction details unavailable");
  const consensus = tx.consensus_data || {};
  const receipts = [...(consensus.leader_receipt || []), ...(consensus.validators || []), ...(consensus.votes || [])];
  const resultName = String(tx.resultName || "").toUpperCase();
  const executionName = String(tx.txExecutionResultName || "").toUpperCase();
  const agreed = ["AGREE", "MAJORITY_AGREE"].includes(resultName) || receipts.some(item => String(item.vote || item.result || "").toUpperCase().includes("AGREE"));
  const receiptExecutions = receipts.map(item => String(item.execution_result || "").toUpperCase()).filter(Boolean);
  const explicitError = ["FINISHED_WITH_ERROR", "ERROR"].includes(executionName) || receiptExecutions.some(item => item.includes("ERROR"));
  const executionSucceeded = ["SUCCESS", "FINISHED_WITH_RETURN"].includes(executionName)
    || receiptExecutions.some(item => ["SUCCESS", "FINISHED_WITH_RETURN"].includes(item));
  if (String(tx.statusName || "").toUpperCase() !== "FINALIZED" || !agreed || explicitError || !executionSucceeded) {
    throw new Error(`Finalized without successful agreed execution (${resultName || "unknown"}/${executionName || "unavailable"})`);
  }
  onStatus("READBACK", hash);
  return hash;
}

export function watchWallet(listener: (account: string) => void): () => void {
  if (!window.ethereum?.on) return () => undefined;
  const accountsChanged = (...args: unknown[]) => {
    const accounts = (args[0] || []) as string[];
    listener(accounts[0] || "");
  };
  const chainChanged = () => listener("");
  window.ethereum.on("accountsChanged", accountsChanged);
  window.ethereum.on("chainChanged", chainChanged);
  return () => {
    window.ethereum?.removeListener?.("accountsChanged", accountsChanged);
    window.ethereum?.removeListener?.("chainChanged", chainChanged);
  };
}
