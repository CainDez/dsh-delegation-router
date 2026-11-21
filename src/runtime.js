import { createHash, randomUUID } from 'node:crypto';
import { normalizeConfig } from './config.js';
import { selectRoute } from './policy.js';
import { decisionSnapshot } from './lifecycle.js';
import { ReservationLedger } from './ledger.js';
import { fail, assertActive, parentId } from './errors.js';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text = (v,n,max) => { if (typeof v !== 'string' || !v.trim() || v.length > max) fail('INVALID_REQUEST', n + ' must be non-empty bounded text'); return v; };
export function normalizeRequest(raw) {
  if (!raw || Object.getPrototypeOf(raw) !== Object.prototype) fail('INVALID_REQUEST','Request must be a plain JSON object');
  const allowed = new Set(['prompt','description','candidate_id','policy_revision','cwd']);
  for (const k of Reflect.ownKeys(raw)) if (!allowed.has(k) || !Object.hasOwn(Object.getOwnPropertyDescriptor(raw,k),'value')) fail('INVALID_REQUEST','Unknown or unsafe request field');
  const r = { prompt: text(raw.prompt,'prompt',100000), description: text(raw.description,'description',200) };
  for (const k of ['candidate_id','cwd']) if (raw[k] !== undefined) r[k] = text(raw[k],k,k === 'cwd' ? 4096 : 120);
  if (raw.policy_revision !== undefined) r.policy_revision = text(raw.policy_revision,'policy_revision',128);
  return Object.freeze(r);
}
export function normalizeMetadata(meta) {
  const own = (value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  };
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return undefined;
  const inputModalities = own(meta, 'inputModalities');
  const rawReasoning = own(meta, 'reasoning');
  const efforts = own(rawReasoning, 'efforts');
  const contextData = own(meta, 'context');
  const context = own(contextData, 'contextWindow') ?? own(contextData, 'maxInputTokens') ?? own(meta, 'contextWindow');
  const validModel = Array.isArray(inputModalities) && inputModalities.length > 0 && inputModalities.every(value => typeof value === 'string' && value.trim().length > 0);
  const reasoningDescriptor = Object.getOwnPropertyDescriptor(meta, 'reasoning');
  const absentReasoning = !reasoningDescriptor || 'value' in reasoningDescriptor && reasoningDescriptor.value === undefined;
  const normalizedEfforts = Array.isArray(efforts) ? efforts.map(value => typeof value === 'string' ? value : own(value, 'id')) : absentReasoning && validModel ? [] : undefined;
  return { inputModalities, context: typeof context === 'number' ? context : undefined,
    ...(own(meta, 'provider') === undefined ? {} : {provider:own(meta, 'provider')}),
    ...(own(meta, 'model') === undefined ? {} : {model:own(meta, 'model')}),
    reasoning: normalizedEfforts === undefined ? undefined : { efforts: normalizedEfforts } };
}
/** No method in this class writes any Agent model/options or deployment defaults. */
export class SubagentRouter {
  #runs = new Map(); #byChild = new Map(); #ended = new Map(); #reconcileAttempts = new Set(); #starting = new Map(); #closed = false;
  constructor({ config, resolveModel, readAuthorization, readChildRoute, validateOptions=()=>{}, preflight, invokeNative, journal, now = Date.now, estimateContext = r => Buffer.byteLength(r.prompt,'utf8') + 8192 }) {
    this.config = normalizeConfig(config); this.revision = digest(this.config);
    Object.assign(this, { resolveModel, readAuthorization, readChildRoute, validateOptions, preflight, invokeNative, journal, now, estimateContext });
    const records=journal.load();
    this.ledger = new ReservationLedger(this.config.limits); this.ledger.recover(records);
    const latest=new Map(records.map(record=>[record.decisionId,record]));
    this.recovered=new Set([...latest.values()].filter(record=>['intent','accepted','unknown'].includes(record.status)).map(record=>record.decisionId));
  }
  assertParent(parent, signal, allowDescendant = false) {
    parentId(parent); assertActive(signal);
    if (this.#closed || !this.config.enabled) fail('ROUTER_DISABLED','Child router is disabled');
    if (!allowDescendant && (parent.session.header?.origin === 'subagent' || parent.session.header?.parentSession !== undefined)) fail('ROOT_ONLY','Explicit routed_subagent is root-only');
  }
  async plan(parent, raw, signal, nativeEntry) {
    const allowDescendant = nativeEntry !== undefined;
    this.assertParent(parent,signal,allowDescendant); const request = normalizeRequest(raw);
    if (request.policy_revision && request.policy_revision !== this.revision) fail('STALE_POLICY','Read delegation_routes again');
    const candidateId = request.candidate_id ?? this.config.defaultCandidateId;
    const candidate = this.config.candidates.find(item => item.id === candidateId);
    if (!candidate) fail('NO_ROUTE','Selected candidate does not exist; no fallback is permitted');
    this.authorization(parent);
    const catalog = new Map();
    await this.prepareBounded(async combined => {
      let info;
      try { info = await this.resolveModel(candidate.provider,candidate.model,combined); }
      catch (e) { if (combined.aborted) throw e; /* A failed selected target cannot trigger another route. */ }
      if (!combined.aborted) catalog.set(candidate.id,normalizeMetadata(info));
    },signal);
    this.assertParent(parent,signal,allowDescendant);
    const backend = nativeEntry === 'subagent_fork' ? 'fork' : 'spawn';
    const facts = { payload: { backend, inputModalities:['text'], context:{tokens:this.estimateContext(request,parent,backend)} } };
    const proposal = request.candidate_id === undefined ? undefined : { candidateId:request.candidate_id };
    const route = Object.freeze(selectRoute(this.config,{facts,proposal,catalog,authorizedRoutes:this.authorization(parent)}));
    const options = Object.freeze({ provider:route.provider, model:route.model, ...(route.effort === null ? {} : {reasoningEffort:route.effort}) });
    const plan = Object.freeze({ request, route, options, facts, catalog, proposal, nativeEntry });
    this.validateSelected(parent,plan);
    // The resolver's host will preflight its final, authorized native arguments itself.
    if (!nativeEntry) await this.prepareBounded(s => this.preflight(options,s),signal);
    this.assertParent(parent,signal,allowDescendant);
    // Parent identity and authorization are checked after every asynchronous preparation stage.
    this.validateSelected(parent,plan);
    return plan;
  }
  run(parent, raw, exec) {
    // Only host execution identity is an idempotency key; model-controlled prompt hashes are not.
    const request = normalizeRequest(raw);
    const key = parentId(parent) + ':' + text(exec.callId,'callId',500);
    const fingerprint = digest(request);
    raw = request;
    const existing = this.#runs.get(key);
    if (existing) { if (existing.fingerprint !== fingerprint) fail('CALL_ID_REUSE','Call identity reused with different arguments'); return existing.promise; }
    if(this.#runs.size>=10000) fail('CALL_HISTORY_LIMIT','Reload router only after children are reconciled; call receipt cache is full');
    const promise = this.#run(parent,raw,exec);
    this.#runs.set(key,{fingerprint,promise}); return promise;
  }
  /** One reservation/audit transition path for native, fork, and legacy routed creation. */
  #lease(parent, plan, exec) {
    const { route, nativeEntry } = plan;
    const pid = parentId(parent), decisionId = randomUUID();
    const modelId = JSON.stringify([route.provider,route.model]);
    const base = { decisionId,parentId:pid,policyRevision:this.revision,modelId,candidateId:route.candidateId,provider:route.provider,model:route.model,effort:route.effort,kind:'subagent',
      ...(nativeEntry ? {entry:nativeEntry,routingReason:route.reason} : {}) };
    const record = (status,extra={}) => this.journal.append({...base,status,time:this.now(),...extra});
    let phase = 'planned', reservation, acceptedChildId;
    const assertCurrent = () => { this.assertParent(parent,exec.signal,!!nativeEntry); this.validateSelected(parent,plan); };
    const untrack = () => {
      const n = (this.#starting.get(pid) ?? 1) - 1;
      if (n > 0) this.#starting.set(pid,n);
      else { this.#starting.delete(pid); for (const k of this.#ended.keys()) if (k.startsWith(pid+'\0')) this.#ended.delete(k); }
    };
    const beforeStart = () => {
      if (phase !== 'planned') fail('CALL_ID_REUSE','This route lease was already used');
      assertCurrent();
      reservation = this.ledger.reserve(pid,modelId);
      try { record('intent'); }
      catch (error) {
        this.ledger.unknown(reservation); this.recovered.add(decisionId); phase = 'done';
        throw error;
      }
      this.#starting.set(pid,(this.#starting.get(pid) ?? 0)+1);
      phase = 'starting';
      // Durable intent may fail or synchronously invalidate admission. Do not
      // let the native host begin creation after such a change.
      try { assertCurrent(); }
      catch (error) { failStart(error,true); throw error; }
    };
    const failStart = (error, definitelyNotStarted = false) => {
      if (phase !== 'starting') return;
      phase = 'done';
      if (definitelyNotStarted) {
        this.ledger.reject(reservation);
        try { record('rejected',{code:error?.code ?? 'REJECTED'}); }
        catch { this.ledger.pause(pid); this.recovered.add(decisionId); }
      } else {
        this.ledger.unknown(reservation); this.recovered.add(decisionId);
        if (acceptedChildId) this.#byChild.delete(pid+'\0'+acceptedChildId);
        try { record('unknown',{code:error?.code ?? 'START_FAILED',...(acceptedChildId ? {childId:acceptedChildId} : {})}); } catch {}
      }
      untrack();
    };
    const accepted = childId => {
      if (phase !== 'starting') fail('INVALID_ACTIVATION','No pending start for this route lease');
      try {
        if (typeof childId !== 'string' || !childId.trim() || childId.length > 500 || childId === pid) fail('START_UNKNOWN','Native activation has no verified child Session identity');
        acceptedChildId = childId;
        this.ledger.accept(reservation,childId);
        const key = pid+'\0'+childId;
        this.#byChild.set(key,{reservation,base});
        record('accepted',{childId});
        const ended = this.#ended.get(key);
        phase = 'done'; untrack();
        if (ended) { this.#ended.delete(key); this.settle(pid,childId,ended); }
      } catch (error) { failStart(error); throw error; }
    };
    return { decisionId, assertCurrent, beforeStart, accepted, failStart };
  }
  async prepareNative(parent, raw, exec, entry) {
    if (entry !== 'subagent' && entry !== 'subagent_fork') fail('INVALID_NATIVE_SELECTION','Unsupported native entry');
    const plan = await this.plan(parent,raw,exec.signal,entry);
    const lease = this.#lease(parent,plan,exec);
    return Object.freeze({provider:plan.route.provider,model:plan.route.model,effort:plan.route.effort,
      assertCurrent:lease.assertCurrent,beforeStart:lease.beforeStart,accepted:lease.accepted,unknown:lease.failStart});
  }
  async #run(parent,raw,exec) {
    const plan = await this.plan(parent,raw,exec.signal); const {request,route,options} = plan;
    const lease = this.#lease(parent,plan,exec);
    let invoked = false;
    try {
      lease.beforeStart();
      const args = { prompt:request.prompt,description:request.description,provider:options.provider,model:options.model,
        ...(options.reasoningEffort === undefined ? {} : {reasoning_effort:options.reasoningEffort}),...(request.cwd ? {cwd:request.cwd} : {}) };
      lease.assertCurrent();
      invoked = true;
      const result = await this.invokeNative(args,exec,lease.assertCurrent);
      if (result?.kind !== 'activation') fail('START_UNKNOWN','Native adapter did not return an activation');
      lease.accepted(result.childId);
      return { ...result, decisionId:lease.decisionId, candidateId:route.candidateId, selected:{provider:options.provider,model:options.model,effort:options.reasoningEffort ?? null}, routingReason:route.reason };
    } catch (error) {
      lease.failStart(error,!invoked || error?.definitelyNotStarted === true);
      if (error && typeof error === 'object') error.decisionId=lease.decisionId;
      throw error;
    }
  }
  authorization(parent) {
    const routes=this.readAuthorization(parent);
    if (!Array.isArray(routes)) fail('AUTHORIZATION_UNAVAILABLE','Session policy cannot be read');
    return routes;
  }
  async prepareBounded(operation,signal) {
    assertActive(signal);
    const controller=new AbortController(), combined=signal ? AbortSignal.any([signal,controller.signal]) : controller.signal;
    let timer,onAbort;
    const stopped=new Promise((_,reject)=>{
      onAbort=()=>reject(Object.assign(new Error(signal?.aborted ? 'Preparation cancelled' : 'Preparation timed out'),{code:signal?.aborted ? 'CANCELLED' : 'METADATA_TIMEOUT'}));
      combined.addEventListener('abort',onAbort,{once:true});
      timer=setTimeout(()=>controller.abort(),this.config.limits.metadataTimeoutMs);
    });
    try { return await Promise.race([Promise.resolve().then(()=>operation(combined)),stopped]); }
    finally { clearTimeout(timer); combined.removeEventListener('abort',onAbort); }
  }
  validateSelected(parent,plan) {
    if (!plan.nativeEntry) this.validateOptions(parent,plan.route);
    const routes=this.authorization(parent);
    let selected;
    try { selected=selectRoute(this.config,{facts:plan.facts,proposal:plan.proposal,catalog:plan.catalog,authorizedRoutes:routes}); }
    catch (error) { if (error?.code === 'NO_ROUTE') fail('STALE_AUTHORIZATION','Selected candidate is no longer authorized or supported'); throw error; }
    if (selected.candidateId !== plan.route.candidateId || selected.provider !== plan.route.provider || selected.model !== plan.route.model || selected.effort !== plan.route.effort) fail('STALE_AUTHORIZATION','Selected candidate changed during preparation');
  }
  decisions(parent,options={}) {
    return decisionSnapshot(parent,this.journal.load(),{...options,readChildRoute:this.readChildRoute,recovered:this.recovered});
  }
  settle(pid,childId,evidence={source:'subagent/end'}) {
    const key=pid+'\0'+childId, value=this.#byChild.get(key);
    if (!value) { if(this.#starting.has(pid)) this.#ended.set(key,evidence); return; }
    try { this.journal.append({...value.base,status:'settled',childId,time:this.now(),settlement:evidence}); }
    catch (error) {
      this.ledger.pause(pid); this.recovered.add(value.base.decisionId);
      // An append/fsync failure can be ambiguous; duplicate end must not retry it.
      this.#byChild.delete(key); throw error;
    }
    this.ledger.settle(pid,childId); this.#byChild.delete(key);
  }
  /** Only the host integration supplies this evidence after a fresh durable ownership check. */
  reconcileCompleted(pid,childId,evidence) {
    if(this.#closed)fail('ROUTER_DISABLED','Router has been disposed');
    if(!evidence || evidence.source!=='persisted-turn-end' || evidence.reason!=='completed' || evidence.parentId!==pid || evidence.childId!==childId || !Number.isSafeInteger(evidence.startSeq) || evidence.startSeq<0 || !Number.isSafeInteger(evidence.endSeq) || evidence.endSeq<=evidence.startSeq) fail('RECONCILIATION_EVIDENCE','Authoritative owned terminal evidence is required');
    if(this.#starting.size || this.#byChild.size)fail('RECOVERY_BUSY','Wait for currently tracked starts and children to settle before reconciling recovered history');
    const records=this.journal.load(),latest=new Map(records.map(record=>[record.decisionId,record]));
    const matches=[...latest.values()].filter(record=>record.parentId===pid && record.childId===childId);
    if(matches.length!==1)fail('RECONCILIATION_SCOPE','Exactly one existing accepted decision for this child is required');
    const record=matches[0];
    if(record.status==='settled')return {childId,decisionId:record.decisionId,status:'settled',alreadySettled:true};
    if(record.status!=='accepted')fail('RECOVERY_REQUIRED','Unknown outcomes and intent-only decisions cannot be reconciled as accepted children');
    if(this.#reconcileAttempts.has(record.decisionId))fail('RECOVERY_REQUIRED','Previous reconciliation write was ambiguous; inspect the durable journal before reload');
    const settlement={source:evidence.source,startSeq:evidence.startSeq,endSeq:evidence.endSeq,reason:evidence.reason};
    const terminal={...record,status:'settled',time:this.now(),settlement};
    const rebuilt=new ReservationLedger(this.config.limits);rebuilt.recover([...records,terminal]);
    this.#reconcileAttempts.add(record.decisionId);
    try {this.journal.append(terminal);}catch(error){this.ledger.pause(pid);this.recovered.add(record.decisionId);throw error;}
    latest.set(record.decisionId,terminal);
    this.recovered=new Set([...latest.values()].filter(item=>['intent','accepted','unknown'].includes(item.status)).map(item=>item.decisionId));
    this.ledger=rebuilt;
    return {childId,decisionId:record.decisionId,status:'settled',reconciled:true,settlement};
  }
  close() { this.#closed=true; this.journal.close(); }
}
