import { fail } from './errors.js';

/** Probe shape only. Never perform a command, model call, or configuration write. */
export function assertHostMethods(service, name, methods) {
  const missing = methods.filter(method => typeof service?.[method] !== 'function');
  if (missing.length) fail('HOST_INCOMPATIBLE', name + ' lacks required methods: ' + missing.join(', '));
}

/** Messages are authored by the plugin; do not forward arbitrary host errors. */
export function hostDiagnostic(ctx, code, message) {
  const text = 'dsh-delegation-router [' + code + ']: ' + message;
  try {
    if (typeof ctx?.logger?.warn === 'function') { ctx.logger.warn(text); return; }
  } catch { /* The logger can also be missing on an incompatible host. */ }
  console.warn(text);
}
