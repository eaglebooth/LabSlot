"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Beaker, CalendarCheck, Check, CircleAlert, FlaskConical,
  Radio, RefreshCw, ScanSearch, ShieldCheck, TimerReset, Wallet,
} from "lucide-react";
import { connectWallet, currentAccount, readJson, watchWallet, writeContract, type Encodable } from "@/lib/chain";
import { defaultContract, explorer } from "@/lib/network";

type ChainState = Record<string, unknown>;
type Mode = "register" | "open" | "commit" | "reveal" | "close" | "assess" | "clear";
type Form = Record<string, string>;

const DEFAULT_POLICY = `LabSlot centrifuge policy for equipment centrifuge-07.
[C1] Rotor speed must not exceed 12000 rpm.
[C2] Biohazardous, radioactive, explosive, and unknown materials are prohibited.
[C3] A trained observer must remain present during acceleration and spin.
[C4] Rotor balance must be verified before start.
[C5] The rotor and work surface must be decontaminated and receive a signed handoff after the run.`;

const DEFAULT_PROTOCOL = `Experiment protocol for centrifuge-07. The run uses sealed non-hazardous saline samples at 9000 rpm. No biohazardous, radioactive, explosive, or unknown material will be introduced. A trained observer will remain present during acceleration and spin. Rotor balance will be verified before start. After the run, the rotor and work surface will be decontaminated and the equipment will receive a signed handoff.`;

const initial: Form = {
  operator: "",
  facilityId: "lab-east",
  equipmentId: "centrifuge-07",
  policyText: DEFAULT_POLICY,
  roundId: "round-01",
  slotId: "2026-10-01-am",
  maxRequests: "4",
  requestId: "req-01",
  protocolText: DEFAULT_PROTOCOL,
  duration: "90",
  nonce: "research-secret-01",
};

const modes: { id: Mode; number: string; label: string }[] = [
  { id: "register", number: "01", label: "Facility" },
  { id: "open", number: "02", label: "Round" },
  { id: "commit", number: "03", label: "Commit" },
  { id: "reveal", number: "04", label: "Reveal" },
  { id: "close", number: "05", label: "Close" },
  { id: "assess", number: "06", label: "Qualify" },
  { id: "clear", number: "07", label: "Allocate" },
];

const short = (value: string) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "—";
const text = (value: unknown) => String(value ?? "");
const count = (value: unknown) => Number(value || 0);

async function requestCommitment(form: Form, researcher: string): Promise<string> {
  const payload = {
    domain: "LABSLOT_REQUEST_COMMITMENT_V1",
    duration_minutes: Number(form.duration),
    facility_id: form.facilityId.trim(),
    nonce: form.nonce.trim(),
    operator: form.operator.toLowerCase(),
    protocol_text: form.protocolText.trim(),
    request_id: form.requestId.trim(),
    researcher: researcher.toLowerCase(),
    round_id: form.roundId.trim(),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(item => item.toString(16).padStart(2, "0")).join("");
}

export default function Home() {
  const [contract, setContract] = useState(defaultContract());
  const [account, setAccount] = useState("");
  const [form, setForm] = useState<Form>(initial);
  const [mode, setMode] = useState<Mode>("register");
  const [facility, setFacility] = useState<ChainState | null>(null);
  const [round, setRound] = useState<ChainState | null>(null);
  const [request, setRequest] = useState<ChainState | null>(null);
  const [txState, setTxState] = useState("IDLE");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const set = (key: string, value: string) => setForm(previous => ({ ...previous, [key]: value }));

  const sync = useCallback(async (quiet = false) => {
    if (!contract || !form.operator) throw new Error("Contract address and operator are required for readback");
    if (!quiet) setTxState("READING");
    setError("");
    try {
      const facilityState = await readJson(contract, "get_facility", [form.operator, form.facilityId]);
      setFacility(facilityState);
      const roundState = await readJson(contract, "get_round", [form.operator, form.facilityId, form.roundId]);
      setRound(roundState);
      const requestState = await readJson(contract, "get_request", [form.operator, form.facilityId, form.roundId, form.requestId]);
      setRequest(requestState);
      if (!quiet) setTxState("SYNCED");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      if (!quiet) setTxState("ERROR");
      throw cause;
    }
  }, [contract, form.operator, form.facilityId, form.roundId, form.requestId]);

  useEffect(() => {
    currentAccount().then(setAccount).catch(() => undefined);
    return watchWallet(next => {
      setAccount(next);
      setFacility(null);
      setRound(null);
      setRequest(null);
      setTxState("WALLET_CHANGED");
    });
  }, []);

  const operatorConnected = Boolean(account && form.operator && account.toLowerCase() === form.operator.toLowerCase());
  const requestOwner = Boolean(account && account.toLowerCase() === text(request?.researcher).toLowerCase());
  const roundStatus = text(round?.status || "NOT SYNCED");
  const requestStatus = text(request?.status || "NOT SUBMITTED");

  const gate = useMemo(() => {
    if (!account) return { allowed: false, reason: "Connect a funded StudioNet wallet." };
    if (mode === "register") return { allowed: true, reason: "Connected wallet becomes this facility operator." };
    if (mode === "open") return { allowed: operatorConnected && facility?.exists === true, reason: operatorConnected ? "Uses the current policy revision." : "Only the facility operator can open a round." };
    if (mode === "commit") return { allowed: roundStatus === "OPEN" && !operatorConnected && request?.exists !== true, reason: operatorConnected ? "Operator cannot submit its own request." : "Researcher commits hidden protocol bytes." };
    if (mode === "reveal") return { allowed: roundStatus === "OPEN" && requestOwner && requestStatus === "COMMITTED", reason: "Requires the exact researcher, protocol, duration and nonce." };
    if (mode === "close") return { allowed: operatorConnected && roundStatus === "OPEN" && count(round?.request_count) > 0, reason: "Operator freezes the bounded request set." };
    if (mode === "assess") return { allowed: roundStatus === "CLOSED" && requestStatus === "REVEALED", reason: "Any wallet may trigger independent semantic qualification." };
    return { allowed: roundStatus === "CLOSED" && count(round?.request_count) > 0 && count(round?.resolved_count) === count(round?.request_count), reason: "Every request must be resolved before allocation." };
  }, [account, mode, operatorConnected, facility, round, request, roundStatus, requestOwner, requestStatus]);

  async function submit() {
    setError("");
    if (!gate.allowed) {
      setError(gate.reason);
      return;
    }
    let method = "";
    let args: Encodable[] = [];
    try {
      if (mode === "register") {
        method = "register_facility";
        args = [form.facilityId, form.equipmentId, form.policyText];
      } else if (mode === "open") {
        method = "open_round";
        args = [form.facilityId, form.roundId, form.slotId, BigInt(form.maxRequests || 0)];
      } else if (mode === "commit") {
        const sealed = await requestCommitment(form, account);
        method = "commit_request";
        args = [form.operator, form.facilityId, form.roundId, form.requestId, sealed];
      } else if (mode === "reveal") {
        method = "reveal_request";
        args = [form.operator, form.facilityId, form.roundId, form.requestId, form.protocolText, BigInt(form.duration || 0), form.nonce];
      } else if (mode === "close") {
        method = "close_round";
        args = [form.facilityId, form.roundId];
      } else if (mode === "assess") {
        method = "assess_request";
        args = [form.operator, form.facilityId, form.roundId, form.requestId];
      } else {
        method = "clear_round";
        args = [form.operator, form.facilityId, form.roundId];
      }
      const hash = await writeContract(contract, account, method, args, (next, currentHash) => {
        setTxState(next);
        if (currentHash) setTxHash(currentHash);
      });
      setTxHash(hash);
      if (mode === "register") set("operator", account);
      const operator = mode === "register" ? account : form.operator;
      const freshFacility = await readJson(contract, "get_facility", [operator, form.facilityId]);
      const freshRound = await readJson(contract, "get_round", [operator, form.facilityId, form.roundId]);
      const freshRequest = await readJson(contract, "get_request", [operator, form.facilityId, form.roundId, form.requestId]);
      const transitionOk = mode === "register" ? freshFacility.exists === true && text(freshFacility.operator).toLowerCase() === account.toLowerCase()
        : mode === "open" ? freshRound.exists === true && text(freshRound.status) === "OPEN"
        : mode === "commit" ? freshRequest.exists === true && text(freshRequest.status) === "COMMITTED" && text(freshRequest.researcher).toLowerCase() === account.toLowerCase()
        : mode === "reveal" ? text(freshRequest.status) === "REVEALED" && Boolean(text(freshRequest.protocol_digest))
        : mode === "close" ? text(freshRound.status) === "CLOSED"
        : mode === "assess" ? ["COMPATIBLE", "INCOMPATIBLE", "UNRESOLVED"].includes(text(freshRequest.status)) && Boolean(text(freshRequest.assessment_digest))
        : ["ALLOCATED", "NO_MATCH"].includes(text(freshRound.status));
      if (!transitionOk) throw new Error(`Transaction finalized but ${mode} state transition was not confirmed by contract readback`);
      setFacility(freshFacility);
      setRound(freshRound);
      setRequest(freshRequest);
      setTxState("VERIFIED");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setTxState("ERROR");
    }
  }

  async function recover(method: "withdraw_request" | "mark_no_reveal" | "cancel_round", args: Encodable[]) {
    setError("");
    try {
      const hash = await writeContract(contract, account, method, args, (next, currentHash) => {
        setTxState(next);
        if (currentHash) setTxHash(currentHash);
      });
      setTxHash(hash);
      await sync(true);
      const freshRound = await readJson(contract, "get_round", [form.operator, form.facilityId, form.roundId]);
      const freshRequest = await readJson(contract, "get_request", [form.operator, form.facilityId, form.roundId, form.requestId]);
      const recoveryOk = method === "withdraw_request" ? text(freshRequest.status) === "WITHDRAWN"
        : method === "mark_no_reveal" ? text(freshRequest.status) === "NO_REVEAL"
        : text(freshRound.status) === "CANCELLED";
      if (!recoveryOk) throw new Error(`Transaction finalized but ${method} state transition was not confirmed by contract readback`);
      setTxState("VERIFIED");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setTxState("ERROR");
    }
  }

  const selected = modes.find(item => item.id === mode)!;
  const progress = ["OPEN", "CLOSED", "ALLOCATED", "NO_MATCH", "CANCELLED"].indexOf(roundStatus);

  return <main>
    <header className="topbar">
      <a className="brand" href="#top" aria-label="LabSlot home">
        <Image src="/labslot-logo.png" alt="LabSlot calendar and laboratory flask" width={44} height={44} priority />
        <span><b>LABSLOT</b><small>SEMANTIC EQUIPMENT SCHEDULER</small></span>
      </a>
      <div className="network"><Radio size={13}/> STUDIONET <b>61999</b></div>
      <button className="wallet" onClick={async () => {
        try { setAccount(await connectWallet()); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
      }}><Wallet size={17}/>{account ? short(account) : "CONNECT WALLET"}</button>
    </header>

    <section className="hero" id="top">
      <div className="hero-copy">
        <span className="eyebrow">SEMANTIC QUALIFICATION × FAIR ALLOCATION</span>
        <h1>Book the instrument.<br/><em>Prove the protocol fits.</em></h1>
        <p>Facility policy comes from its operator. Experiment protocol comes from a different researcher. GenLayer qualifies the language; deterministic code awards the earliest compatible request.</p>
        <div className="authority-line"><span>OPERATOR POLICY</span><i/><span>RESEARCHER COMMITMENT</span><i/><span>ON-CHAIN SLOT</span></div>
      </div>
      <div className="hero-visual">
        <div className="specimen-ring"><Image src="/labslot-logo.png" alt="LabSlot mark" width={480} height={480} priority /></div>
        <div className="seal"><ShieldCheck/><span>SENDER<br/>AUTHORIZED</span></div>
      </div>
    </section>

    <section className="identity-strip">
      <label><span>CONTRACT ADDRESS</span><input value={contract} onChange={event => setContract(event.target.value)} placeholder="0x deployed contract"/></label>
      <label><span>FACILITY OPERATOR</span><input value={form.operator} onChange={event => set("operator", event.target.value)} placeholder="0x operator wallet"/></label>
      <label><span>FACILITY / ROUND / REQUEST</span><div className="triple"><input value={form.facilityId} onChange={event => set("facilityId", event.target.value)}/><input value={form.roundId} onChange={event => set("roundId", event.target.value)}/><input value={form.requestId} onChange={event => set("requestId", event.target.value)}/></div></label>
      <button className="sync" onClick={() => sync()}><RefreshCw size={16}/> SYNC CHAIN</button>
    </section>

    <section className="instrument-console">
      <aside className="phase-rail">
        <span className="micro">PROTOCOL SEQUENCE</span>
        {modes.map(item => <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)}>
          <i>{item.number}</i><span>{item.label}<small>{phaseDetail(item.id)}</small></span>
        </button>)}
        <div className="truth-note"><ShieldCheck/><p><b>Authority is not a file.</b> Policy and protocol are authenticated by their submitting wallets and frozen in contract state.</p></div>
      </aside>

      <div className="workbench">
        <header className="workbench-head">
          <div><span className="micro">STEP {selected.number}</span><h2>{actionTitle(mode)}</h2></div>
          <div className={`state-chip ${["ALLOCATED", "AWARDED", "COMPATIBLE"].includes(roundStatus) ? "positive" : ""}`}><i/>{roundStatus}</div>
        </header>

        <div className="work-area">
          {mode === "register" && <>
            <Field label="FACILITY ID" value={form.facilityId} onChange={value => set("facilityId", value)}/>
            <Field label="EQUIPMENT ID" value={form.equipmentId} onChange={value => set("equipmentId", value)}/>
            <TextArea label="VERSIONED SAFETY POLICY" value={form.policyText} onChange={value => set("policyText", value)} wide/>
          </>}
          {mode === "open" && <>
            <Field label="ROUND ID" value={form.roundId} onChange={value => set("roundId", value)}/>
            <Field label="SLOT ID" value={form.slotId} onChange={value => set("slotId", value)}/>
            <Field label="MAX REQUESTS (1–6)" value={form.maxRequests} onChange={value => set("maxRequests", value)}/>
            <Fact title="Policy snapshot" body={`Revision ${text(facility?.policy_revision || "—")} · ${short(text(facility?.policy_digest))}`}/>
          </>}
          {(mode === "commit" || mode === "reveal") && <>
            <Field label="REQUEST ID" value={form.requestId} onChange={value => set("requestId", value)}/>
            <Field label="DURATION (MINUTES)" value={form.duration} onChange={value => set("duration", value)}/>
            <Field label="PRIVATE NONCE" value={form.nonce} onChange={value => set("nonce", value)}/>
            <TextArea label="EXPERIMENT PROTOCOL" value={form.protocolText} onChange={value => set("protocolText", value)} wide/>
            <Fact title={mode === "commit" ? "Commit locally" : "Reveal exactly"} body={mode === "commit" ? "The browser hashes exact protocol bytes; only the commitment is written." : `Stored commitment ${short(text(request?.commitment))}`}/>
          </>}
          {mode === "close" && <Decision icon={<CalendarCheck/>} title="Freeze request intake" body="Closing locks this round's bounded request set. Unrevealed requests can then be marked NO_REVEAL by any wallet." chips={[`${count(round?.request_count)} REQUESTS`, `LIMIT ${count(round?.max_requests)}`, `POLICY R${count(round?.policy_revision)}`]}/>} 
          {mode === "assess" && <Decision icon={<ScanSearch/>} title="Independent semantic qualification" body="Leader maps missing and conflicting policy clauses. Validators re-read the exact on-chain policy and protocol, then independently falsify or confirm the consequential result." chips={["COMPATIBLE", "INCOMPATIBLE", "UNRESOLVED"]}/>} 
          {mode === "clear" && <Decision icon={<TimerReset/>} title="Deterministic slot clearing" body="AI never selects the winner. Once every request is resolved, the contract awards the lowest request index among COMPATIBLE protocols." chips={[`${count(round?.resolved_count)} / ${count(round?.request_count)} RESOLVED`, `${count(round?.compatible_count)} COMPATIBLE`]}/>} 
        </div>

        <div className="action-bar">
          <div><span>CONNECTED AUTHORITY</span><b>{operatorConnected ? "FACILITY OPERATOR" : account ? "RESEARCHER / REVIEWER" : "DISCONNECTED"}</b><small>{gate.reason}</small></div>
          <button className="primary" disabled={!gate.allowed} onClick={submit}><FlaskConical size={18}/>{actionButton(mode)}</button>
        </div>

        {(operatorConnected && roundStatus === "OPEN" || requestOwner && roundStatus === "OPEN" && ["COMMITTED", "REVEALED"].includes(requestStatus) || roundStatus === "CLOSED" && requestStatus === "COMMITTED") && <div className="recovery-bar">
          <span>SAFE EXIT PATHS</span>
          {requestOwner && roundStatus === "OPEN" && ["COMMITTED", "REVEALED"].includes(requestStatus) && <button onClick={() => recover("withdraw_request", [form.operator, form.facilityId, form.roundId, form.requestId])}>WITHDRAW REQUEST</button>}
          {operatorConnected && roundStatus === "OPEN" && <button onClick={() => recover("cancel_round", [form.facilityId, form.roundId])}>CANCEL ROUND</button>}
          {roundStatus === "CLOSED" && requestStatus === "COMMITTED" && <button onClick={() => recover("mark_no_reveal", [form.operator, form.facilityId, form.roundId, form.requestId])}>MARK NO REVEAL</button>}
        </div>}

        {(error || txState !== "IDLE") && <div className={`transaction ${error ? "bad" : ""}`}>
          {error ? <CircleAlert/> : <Beaker/>}
          <div><b>{error ? "ACTION STOPPED" : txState}</b><p>{error || txCopy(txState)}</p></div>
          {txHash && <a href={explorer(txHash)} target="_blank" rel="noreferrer">EXPLORER <ArrowUpRight size={14}/></a>}
        </div>}
      </div>
    </section>

    <section className="ledger">
      <div className="ledger-title"><span className="micro">AUTHORITATIVE READBACK</span><h2>Allocation ledger</h2><p>These values are read from the contract after finality, never inferred from wallet approval.</p></div>
      <Metric label="FACILITY" value={text(facility?.facility_id || form.facilityId)} note={`Policy R${count(facility?.policy_revision) || "—"}`} icon={<FlaskConical/>}/>
      <Metric label="ROUND" value={roundStatus} note={`${count(round?.resolved_count)} / ${count(round?.request_count)} resolved`} icon={<CalendarCheck/>}/>
      <Metric label="REQUEST" value={requestStatus} note={text(request?.verdict || "no verdict")} icon={<ScanSearch/>}/>
      <Metric label="WINNER" value={text(round?.winner_request_id || "NONE")} note={short(text(round?.winner_researcher))} icon={<ShieldCheck/>}/>
      <div className="digest-row"><span>POLICY DIGEST <b>{short(text(round?.policy_digest || facility?.policy_digest))}</b></span><span>PROTOCOL DIGEST <b>{short(text(request?.protocol_digest))}</b></span><span>ASSESSMENT <b>{short(text(request?.assessment_digest))}</b></span></div>
      {(text(request?.missing_clause_ids) || text(request?.conflicting_clause_ids)) && <div className="findings"><b>BOUND FINDINGS</b><span>Missing: {text(request?.missing_clause_ids) || "none"}</span><span>Conflicts: {text(request?.conflicting_clause_ids) || "none"}</span></div>}
    </section>

    <section className="round-progress">
      {["OPEN", "CLOSED", "ALLOCATED"].map((item, index) => <div className={progress >= index ? "done" : ""} key={item}><i>{progress >= index ? <Check size={13}/> : index + 1}</i><span>{item}</span></div>)}
    </section>

    <footer><b>LABSLOT</b><span>Policy-bound · Sender-authorized · Deterministically allocated</span><a href="https://genlayer.com" target="_blank" rel="noreferrer">BUILT ON GENLAYER <ArrowUpRight size={13}/></a></footer>
  </main>;
}

function phaseDetail(mode: Mode): string {
  return { register: "operator policy", open: "snapshot slot", commit: "sealed request", reveal: "exact protocol", close: "freeze intake", assess: "validator jury", clear: "choose winner" }[mode];
}
function actionTitle(mode: Mode): string {
  return { register: "Register a facility policy", open: "Open a booking round", commit: "Commit a research request", reveal: "Reveal the exact protocol", close: "Close the intake window", assess: "Qualify one protocol", clear: "Allocate the equipment slot" }[mode];
}
function actionButton(mode: Mode): string {
  return { register: "REGISTER FACILITY", open: "OPEN ROUND", commit: "COMMIT REQUEST", reveal: "REVEAL PROTOCOL", close: "CLOSE ROUND", assess: "RUN QUALIFICATION", clear: "CLEAR ROUND" }[mode];
}
function txCopy(state: string): string {
  if (state === "SIGNATURE") return "Confirm the exact contract call in your wallet.";
  if (state === "CONSENSUS") return "GenLayer validators are executing the bounded action.";
  if (state === "READBACK") return "Finalized. Verifying the authoritative post-state.";
  if (state === "VERIFIED") return "Finalized, agreed and confirmed by contract readback.";
  if (state === "WALLET_CHANGED") return "Wallet changed. Sync again before the next write.";
  return "Reading the latest contract state.";
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={event => onChange(event.target.value)} /></label>;
}
function TextArea({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean }) {
  return <label className={`field textarea ${wide ? "wide" : ""}`}><span>{label}</span><textarea value={value} onChange={event => onChange(event.target.value)} /></label>;
}
function Fact({ title, body }: { title: string; body: string }) {
  return <div className="fact"><ShieldCheck/><div><b>{title}</b><p>{body}</p></div></div>;
}
function Decision({ icon, title, body, chips }: { icon: React.ReactNode; title: string; body: string; chips: string[] }) {
  return <div className="decision">{icon}<div><b>{title}</b><p>{body}</p><div>{chips.map(chip => <span key={chip}>{chip}</span>)}</div></div></div>;
}
function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className="metric"><i>{icon}</i><span>{label}</span><b>{value}</b><small>{note}</small></div>;
}
