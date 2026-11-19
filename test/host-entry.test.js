import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

test('unavailable core import produces an inert plugin with a sanitized diagnostic', async () => {
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (specifier === './router-service.js') throw Error('details that must not be logged');
    return next(specifier, context);
  } });
  try {
    const { default: entry, SubagentRouterService } = await import('../src/plugin.js');
    const warnings = [];
    assert.equal(SubagentRouterService, undefined);
    entry.apply({ logger: { warn: message => warnings.push(message) } });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /HOST_INCOMPATIBLE.*Routing not mounted/);
    assert.doesNotMatch(warnings[0], /details that must not be logged/);
  } finally { hook.deregister(); }
});
