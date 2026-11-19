import { hostDiagnostic } from './host-compatibility.js';

// DSH checks the manifest before evaluating this entry. Inside the admitted
// range, a missing host import/export must not break the rest of the profile.
let core;
try {
  core = await import('./router-service.js');
} catch {
  // Do not surface import errors containing paths or host-supplied details.
}

export const SubagentRouterService = core?.SubagentRouterService;
export default SubagentRouterService ?? {
  apply(ctx) {
    hostDiagnostic(ctx, 'HOST_INCOMPATIBLE', 'Routing not mounted: required host modules or exports could not be loaded. Check the DSH host contract tests.');
  },
};
