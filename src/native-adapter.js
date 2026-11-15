import { randomUUID } from 'node:crypto';

function rejectBeforeStart(code, message) {
  throw Object.assign(new Error(message), { code, definitelyNotStarted: true });
}

// Native schemas are normalized by defineTool; required is a JSON-schema array.
function assertActivationOutput(native) {
  const schema = native?.output?.schema;
  const kind = schema?.properties?.kind;
  const exactActivation = kind?.const === 'activation' ||
    (Array.isArray(kind?.enum) && kind.enum.length === 1 && kind.enum[0] === 'activation');
  const required = schema?.required;
  const field = Array.isArray(required) && required.includes('name') ? 'name' : 'subagentId';
  if (schema?.type !== 'object' || schema.oneOf || schema.anyOf || schema.allOf ||
      !Array.isArray(required) || !required.includes('kind') || !required.includes(field) ||
      kind?.type !== 'string' || !exactActivation || schema.properties?.[field]?.type !== 'string') {
    rejectBeforeStart('NATIVE_OUTPUT_CONTRACT_UNSUPPORTED', 'Native subagent must declare an activation with a required name or durable subagentId');
  }
  return field;
}
const identity = value => typeof value === 'string' && !!value.trim() && value.length <= 500;
const agentName = value => typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value) && value !== 'lead';
function unknown(message) { throw Object.assign(new Error(message), {code:'START_UNKNOWN'}); }
async function childCatalog(ctx, exec) {
  let source;
  try {
    source = await ctx.sessionQuery.observeSession(exec.agent.id, {signal:exec.signal});
    if (source.header?.id !== exec.agent.id) unknown('Parent catalog Session identity mismatch');
    const entries = source.projections?.values?.subagentCatalog;
    if (!Array.isArray(entries)) unknown('Host subagentCatalog projection is unavailable');
    // Detach rows before releasing the host observation lease.
    return entries.map(({id,name}) => ({id,name}));
  } finally { source?.[Symbol.dispose]?.(); }
}
async function activationIdentity(ctx, exec, value, field, previous, requestedName) {
  if (value?.kind !== 'activation') unknown('Native tool did not return an activation');
  let childId, name;
  if (field === 'name') {
    name = value.name;
    if (!agentName(name) || name !== requestedName) unknown('Native receipt does not match the requested direct child name');
    const matches = (await childCatalog(ctx, exec)).filter(entry => entry.name === name);
    if (matches.length !== 1 || !identity(matches[0].id) || previous.some(entry => entry.id === matches[0].id || entry.name === name)) unknown('Native name does not identify exactly one newly cataloged child');
    childId = matches[0].id;
  } else {
    childId = value?.subagentId;
    if (!identity(childId)) unknown('Native activation Session identity is missing');
  }
  if (childId === exec.agent.id) unknown('Native child identity aliases the parent');
  let child;
  try {
    child = await ctx.sessionQuery.observeSession(childId, {signal:exec.signal,projectionMode:'none'});
    const header = child.header;
    if (header?.id !== childId || header.origin !== 'subagent' || header.parentSession !== exec.agent.id) unknown('Native activation Session does not belong to this parent');
  } finally { child?.[Symbol.dispose]?.(); }
  // Preserve the model-facing receipt, but expose the independently verified Session
  // identity separately. Never synthesize subagentId from a display name.
  return {kind:'activation', ...(name === undefined ? {} : {name}), childId};
}

/** Same admitted definitions and staged pipeline as native/PTC; never calls execute directly. */
export function createNativeInvoker(ctx, pipeline, logNested = async () => {}) {
  return async (args, exec, beforeDispatch) => {
    if (!exec.agent || !exec.token || !exec.toolSet || !exec.signal || !exec.callId) rejectBeforeStart('HOST_EXECUTION_REQUIRED', 'A prepared parent tool execution is required');
    const native = ctx.tools.executable('subagent', exec.agent, exec.toolSet);
    if (!native) rejectBeforeStart('NATIVE_TOOL_UNAVAILABLE', 'Native subagent is not admitted; do not bypass Team or scope restrictions');
    const schema = ctx.tools.schemas(exec.agent, exec.toolSet).find(value => value.name === 'subagent');
    const params = schema?.parameters?.properties;
    if (!params?.provider || !params?.model || !params?.reasoning_effort) rejectBeforeStart('NATIVE_MODEL_SELECTION_DISABLED', 'Native subagent does not expose explicit child routing');
    const identityField = assertActivationOutput(native);
    if (typeof ctx.sessionQuery?.observeSession !== 'function') rejectBeforeStart('NATIVE_IDENTITY_UNAVAILABLE', 'Host Session observation is required to audit a native child');
    if (identityField === 'name' && params.name?.type !== 'string') rejectBeforeStart('NATIVE_IDENTITY_UNAVAILABLE', 'Native tool must admit an exact requested child name');
    const requestedName = identityField === 'name' ? 'router-' + randomUUID().replaceAll('-', '').slice(0,24) : undefined;
    let previous;
    try { if (identityField === 'name') previous = await childCatalog(ctx, exec); }
    catch { rejectBeforeStart('NATIVE_IDENTITY_UNAVAILABLE', 'Host parent subagentCatalog cannot be read before dispatch'); }
    const input = {
      callId: String(exec.callId) + ':router', rootCallId: exec.rootCallId ?? exec.callId,
      name: 'subagent', schema, arguments: {...args,...(requestedName ? {name:requestedName} : {})}, agent: exec.agent, toolSet: exec.toolSet,
      parent: exec.token, signal: exec.signal
    };
    let dispatched = false;
    let result, admissionError;
    try {
      const prepared = await pipeline.prepare(input);
      let outcome = prepared;
      if (prepared.kind === 'dispatch') {
        try {
          const current = ctx.tools.executable('subagent', exec.agent, exec.toolSet);
          if (current !== native) rejectBeforeStart('NATIVE_TOOL_CHANGED', 'Native subagent definition changed during preparation; no child was created');
          if (assertActivationOutput(current) !== identityField) rejectBeforeStart('NATIVE_TOOL_CHANGED', 'Native activation identity contract changed during preparation');
          if (requestedName && prepared.exec.arguments?.name !== requestedName) rejectBeforeStart('NATIVE_TOOL_CHANGED', 'Native preparation changed the bound child name');
          const checked = beforeDispatch?.();
          if (checked && typeof checked.then === 'function') {
            void Promise.resolve(checked).catch(() => {});
            throw Object.assign(new Error('Routing admission hook must be synchronous'), { code: 'INVALID_ADMISSION_HOOK' });
          }
        }
        catch (error) {
          admissionError = error instanceof Error ? error : new Error('Routing admission failed before dispatch');
          outcome = { kind: 'post-result', exec: prepared.exec, result: { isError: true,
            error: { message: admissionError.message }, content: [{ type: 'text', text: admissionError.message }] } };
        }
        if (!admissionError) { dispatched = true; outcome = await pipeline.dispatch(prepared.exec); }
      }
      result = await pipeline.complete(prepared.exec, outcome);
    } catch (error) {
      const failure = admissionError ?? error;
      if (admissionError) failure.completionFailed = true;
      if (!dispatched && failure && typeof failure === 'object') failure.definitelyNotStarted = true;
      throw failure;
    }
    try {
      for (const context of result.additionalContexts ?? []) exec.deferContext(context);
      if (result.concludesTurn) exec.concludeTurn();
      await logNested(exec, input, result);
    } catch (error) {
      const failure = admissionError ?? error;
      if (admissionError) failure.postProcessingFailed = true;
      if (!dispatched && failure && typeof failure === 'object') failure.definitelyNotStarted = true;
      throw failure;
    }
    if (admissionError) { admissionError.definitelyNotStarted = true; throw admissionError; }
    if (result.isError) {
      const error = Object.assign(new Error(result.error?.message ?? 'Native delegation rejected'), { code: 'NATIVE_DELEGATION_FAILED' });
      // Only pre-dispatch denial proves no child could have been published.
      if (!dispatched) error.definitelyNotStarted = true;
      throw error;
    }
    try { return await activationIdentity(ctx, exec, result.value, identityField, previous, requestedName); }
    catch (error) { if (!dispatched && error && typeof error === 'object') error.definitelyNotStarted = true; throw error; }
  };
}
