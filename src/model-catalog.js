const text = value => typeof value === 'string' && value.trim().length > 0 && !/[\x00-\x1f\x7f]/.test(value);
const invalid = () => { throw new Error('Invalid model catalog metadata'); };
const unavailable = () => Object.assign(new Error('Model catalog is unavailable'), { code: 'CATALOG_UNAVAILABLE' });
const aborted = () => Object.assign(new Error('Model catalog loading was aborted'), { name: 'AbortError', code: 'ABORTED' });

// Read only the display/identity fields we need, without invoking adapter getters
// or enumerating credentials, configuration, error objects or unrelated metadata.
function field(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return undefined;
  if (!Object.hasOwn(descriptor, 'value')) invalid();
  return descriptor.value;
}
function identity(value) {
  const id = field(value, 'id');
  if (!text(id)) invalid();
  const name = field(value, 'name');
  return { id, name: text(name) ? name : id };
}
function entries(value) {
  if (!Array.isArray(value)) invalid();
  const result = [], seen = new Set();
  for (let i = 0; i < value.length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) invalid();
    const entry = identity(descriptor.value);
    if (seen.has(entry.id)) invalid();
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}
function projectModel(listed, resolved, provider) {
  // A successful exact resolution, not a missing/partial/error response, is the
  // evidence that reasoning === undefined really means no advertised efforts.
  if (field(resolved, 'provider') !== provider || field(resolved, 'id') !== listed.id) invalid();
  const output = { id: listed.id, name: listed.name };
  const reasoning = field(resolved, 'reasoning');
  if (reasoning !== undefined) {
    const efforts = entries(field(reasoning, 'efforts'));
    if (efforts.some(effort => effort.id === 'default')) invalid();
    output.reasoning = { efforts };
    const defaultEffort = field(reasoning, 'defaultEffort');
    if (defaultEffort !== undefined) {
      if (!text(defaultEffort) || !efforts.some(effort => effort.id === defaultEffort)) invalid();
      output.reasoning.defaultEffort = defaultEffort;
    }
  }
  return output;
}

function loadProvider(llm, provider, timeoutMs, timers, cancellations) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false, timer, hasTimer = false;
    const finish = (kind, group) => {
      if (settled) return;
      settled = true;
      cancellations.delete(cancel);
      if (hasTimer) timers.clearTimeout(timer);
      // Stop any sibling metadata lookups when this provider fails. An adapter
      // that ignores abort may finish later, but can never publish its result.
      if (kind !== 'success') controller.abort();
      if (kind === 'abort') return reject(aborted());
      resolve(kind === 'success' ? { group } : { failure: {
        id: provider.id, name: provider.name,
        message: kind === 'timeout' ? 'Model catalog loading timed out.' : 'Model catalog unavailable for this provider.'
      } });
    };
    const cancel = () => finish('abort');
    cancellations.add(cancel);
    timer = timers.setTimeout(() => finish('timeout'), timeoutMs);
    hasTimer = true;
    Promise.resolve().then(async () => {
      if (settled) return;
      // listModels has no signal parameter in some host adapters. Its await is
      // still covered by the same provider deadline as every exact resolution.
      const listed = await llm.listModels(provider.id);
      if (settled) return;
      const models = entries(listed);
      const projected = await Promise.all(models.map(async model => {
        if (settled || controller.signal.aborted) throw aborted();
        const resolved = await llm.resolveModelInfo(provider.id, model.id, controller.signal);
        if (settled || controller.signal.aborted) throw aborted();
        return projectModel(model, resolved, provider.id);
      }));
      if (!settled) finish('success', projected.length ? { ...provider, models: projected } : undefined);
    }).catch(() => finish('failure'));
  });
}

/** Read-only, bounded catalog projection. Each provider is an atomic result. */
export async function loadModelCatalog(llm, signal, { timeoutMs = 5000, timers = globalThis } = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0 || timeoutMs > 2147483647) throw new TypeError('Invalid catalog timeout');
  if (signal?.aborted) throw aborted();
  const cancellations = new Set();
  const onAbort = () => { for (const cancel of [...cancellations]) cancel(); };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    let providers;
    try {
      // This host API is synchronous: do not serialize provider I/O behind it.
      providers = entries(llm.listProviders());
    } catch {
      if (signal?.aborted) throw aborted();
      throw unavailable();
    }
    if (signal?.aborted) throw aborted();
    const results = await Promise.all(providers.map(provider => loadProvider(llm, provider, timeoutMs, timers, cancellations)));
    if (signal?.aborted) throw aborted();
    return {
      groups: results.flatMap(result => result.group ? [result.group] : []),
      failures: results.flatMap(result => result.failure ? [result.failure] : [])
    };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    for (const cancel of [...cancellations]) cancel();
  }
}
