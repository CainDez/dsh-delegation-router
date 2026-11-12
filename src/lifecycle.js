import { fail, parentId } from './errors.js';

export function assertDecisionParent(parent) {
  const id = parentId(parent);
  if (parent.session.header?.origin === 'subagent' || parent.session.header?.parentSession !== undefined) fail('ROOT_ONLY','Routing evidence is root-only');
  return id;
}
const own = (value,key) => {
  if (!value || typeof value !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value,key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
};
const identity = value => typeof value === 'string' && value.length > 0 && value.length <= 500;
/** Whitelist actual request identity; never fall back to Agent options or selected presets. */
export function routeEvidence(value) {
  const provider=own(value,'provider'), model=own(value,'model');
  if (typeof provider !== 'string' || !provider || provider.length>200 || typeof model !== 'string' || !model || model.length>200) return null;
  const effort=own(value,'effort') ?? own(value,'reasoningEffort');
  return Object.freeze({provider,model,effort:typeof effort==='string' && effort.length<=200 ? effort : null});
}
function childHeader(header,childId,pid) {
  if (!header || header.id!==childId || header.origin!=='subagent' || !identity(header.parentSession) || (pid!==undefined && header.parentSession!==pid)) fail('CHILD_SCOPE','Child Session does not belong to this parent');
  return header.parentSession;
}
/** Use the host's live-or-persisted observation lease; never load/resume a child Agent. */
export function createChildReaders({observeSession}) {
  async function withChild(childId,pid,signal,read) {
    if (!identity(childId)) fail('CHILD_SCOPE','A bounded child Session identity is required');
    if (typeof observeSession!=='function') fail('CHILD_EVIDENCE_UNAVAILABLE','Host Session observation is unavailable');
    let source;
    try {
      source=await observeSession(childId,{...(signal?{signal}:{}),projectionMode:'none'});
      signal?.throwIfAborted();
      childHeader(source.header,childId,pid);
      return read(source);
    } finally { source?.[Symbol.dispose]?.(); }
  }
  const readChildRoute=async (parent,childId,signal) => withChild(childId,assertDecisionParent(parent),signal,source=>{
    const events=source.events.slice(source.inheritedEventCount);
    // Initial child-owned request, not a later resumed request or an inherited parent request.
    const request=events.find(event=>event.type==='request/header');
    return routeEvidence(request?.data?.header?.config);
  });
  const readChildOwner=async childId=>withChild(childId,undefined,undefined,source=>source.header.parentSession);
  const readCompletion=async (parent,childId,signal)=>withChild(childId,assertDecisionParent(parent),signal,source=>{
    // A live snapshot or merely idle status is not proof an activation ended.
    // The host synthesizes interrupted closers for crashed logs: only a real completed
    // turn is admitted for manual recovery; all other outcomes remain fail-closed.
    if (source.source!=='prepared') fail('CHILD_NOT_SETTLED','Child Session is still resident; wait for the host lifecycle end');
    const events=source.events.slice(source.inheritedEventCount);
    const end=events.at(-1), start=events.findLast(event=>event.type==='turn/start');
    if (!start || end?.type!=='turn/end' || start.data?.turn!==end.data?.turn || start.seq>=end.seq || end.data?.reason?.kind!=='completed') fail('CHILD_NOT_SETTLED','Persisted child does not end with an authoritative completed turn');
    return Object.freeze({source:'persisted-turn-end',childId,parentId:source.header.parentSession,startSeq:start.seq,endSeq:end.seq,reason:end.data.reason.kind});
  });
  return {readChildRoute,readChildOwner,readCompletion};
}
/** Host end dispatch is AFTER registry disposal. Capture start ownership, with durable fallback. */
export function createLifecycleHandlers({getAgent,getSession,readChildOwner,settle,onError=()=>{}}) {
  const owners=new Map();
  const report=(error,pid,childId)=>{try{onError(error,pid,childId);}catch{/* Never break host lifecycle dispatch. */}};
  function start(info) {
    const childId=own(info,'id'),runId=own(info,'runId');
    if (!identity(childId) || !identity(runId) || own(info,'local')!==true) return;
    try {
      const session=getAgent?.(childId)?.session ?? getSession?.(childId);
      if (!session) return;
      const pid=childHeader(session.header,childId);
      if (owners.size>=10000 && !owners.has(childId)) fail('LIFECYCLE_CAPACITY','Too many unclosed host activations');
      owners.set(childId,{pid,runId});
    } catch(error) { report(error,undefined,childId); }
  }
  async function end(info) {
    const childId=own(info,'id'),runId=own(info,'runId'); let pid;
    if (!identity(childId) || !identity(runId) || own(info,'local')!==true) return;
    try {
      const captured=owners.get(childId);
      if (captured) {
        if (captured.runId!==runId) return; // A stale epoch must not consume a newer start.
        pid=captured.pid; owners.delete(childId);
      } else {
        if (typeof readChildOwner!=='function') return;
        pid=await readChildOwner(childId);
      }
      await settle(pid,childId,{source:'subagent/end',runId});
    } catch(error) { report(error,pid,childId); }
  }
  return {start,end,clear:()=>owners.clear()};
}
export function decisionLimit(limit=20) {
  if (!Number.isInteger(limit) || limit<1 || limit>100) fail('INVALID_REQUEST','Decision limit must be an integer from 1 to 100');
  return limit;
}
/** Projection only; does not acquire a journal lock or mutate a decision. */
export async function decisionSnapshot(parent,records,{limit=20,readChildRoute,recovered=new Set()}={}) {
  const pid=assertDecisionParent(parent); decisionLimit(limit);
  const latest=new Map(), accepted=new Set();
  for (const record of records) if (record.parentId===pid) {
    latest.set(record.decisionId,record);
    if (record.status==='accepted') accepted.add(record.decisionId);
  }
  const result=[];
  for (const record of [...latest.values()].slice(-limit).reverse()) {
    let observed=null;
    if (record.childId && readChildRoute) {
      try { observed=routeEvidence(await readChildRoute(parent,record.childId)); } catch { /* Missing evidence is not proof of execution. */ }
    }
    const unknown=record.status==='unknown' || recovered.has(record.decisionId);
    const status=unknown ? 'unknown' : record.status==='intent' ? 'selected' : record.status==='accepted' && observed ? 'observed' : record.status;
    result.push(Object.freeze({decisionId:record.decisionId,policyRevision:record.policyRevision,kind:record.kind,
      status,selected:routeEvidence(record),accepted:accepted.has(record.decisionId),observed,
      settled:!unknown && record.status==='settled',unknown,
      ...(typeof record.presetId==='string'?{presetId:record.presetId}:{}),
      ...(typeof record.childId==='string'?{childId:record.childId}:{}),
      ...(typeof record.time==='number' && Number.isFinite(record.time)?{time:record.time}:{})}));
  }
  return result;
}
