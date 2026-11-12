function rejectBeforeStart(code, message) {
  throw Object.assign(new Error(message), { code, definitelyNotStarted: true });
}

// A display name is not a durable child Session identity. Refuse incompatible
// host output contracts before a native tool can publish an untrackable child.
function assertActivationOutput(native) {
  const schema = native?.output?.schema;
  const kind = schema?.properties?.kind;
  const exactActivation = kind?.const === 'activation' ||
    (Array.isArray(kind?.enum) && kind.enum.length === 1 && kind.enum[0] === 'activation');
  if (schema?.type !== 'object' || schema.oneOf || schema.anyOf || schema.allOf ||
      !Array.isArray(schema.required) || !schema.required.includes('kind') || !schema.required.includes('subagentId') ||
      kind?.type !== 'string' || !exactActivation || schema.properties?.subagentId?.type !== 'string') {
    rejectBeforeStart('NATIVE_OUTPUT_CONTRACT_UNSUPPORTED', 'Native subagent must declare an activation with a required durable subagentId; name-only receipts are unsupported');
  }
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
    assertActivationOutput(native);
    const input = {
      callId: String(exec.callId) + ':router', rootCallId: exec.rootCallId ?? exec.callId,
      name: 'subagent', schema, arguments: args, agent: exec.agent, toolSet: exec.toolSet,
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
          assertActivationOutput(current);
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
    return result.value;
  };
}
