export function fail(code, message) { throw Object.assign(new Error(message), { code }); }
export function assertActive(signal) { if (signal?.aborted) fail('CANCELLED', 'Delegation cancelled before creation'); }
export function parentId(parent) { if (!parent || typeof parent.id !== 'string' || !parent.session) fail('NO_PARENT', 'A live parent Agent is required'); return parent.id; }
