import { fail } from './errors.js';
const RECORD_FIELDS = new Set(['decisionId','parentId','policyRevision','modelId','candidateId','provider','model','effort','kind','status','time','childId','code','settlement']);
/** Synchronous reservation transitions are atomic on the host's JS event loop. */
export class ReservationLedger {
  parents = new Map();
  constructor(limits) { this.limits = limits; }
  state(id) { if (!this.parents.has(id)) this.parents.set(id, { created: 0, pending: 0, active: new Map(), paused: false }); return this.parents.get(id); }
  recover(records) {
    const decisions = new Map();
    const transitions={intent:new Set(['accepted','rejected','unknown']),accepted:new Set(['settled','unknown']),unknown:new Set([]),rejected:new Set([]),settled:new Set([])};
    for (const r of records) {
      if (!r || typeof r.decisionId !== 'string' || !r.decisionId || typeof r.parentId !== 'string' || !r.parentId || !Object.hasOwn(transitions,r.status)) fail('AUDIT_CORRUPT', 'Invalid audit record');
      if (typeof r.candidateId !== 'string' || !r.candidateId || r.candidateId.length > 120 || r.kind !== 'subagent' || Object.keys(r).some(key => !RECORD_FIELDS.has(key))) fail('AUDIT_FORMAT_UNSUPPORTED','Invalid fixed-candidate audit record fields');
      const previous=decisions.get(r.decisionId);
      if (!previous && r.status!=='intent') fail('AUDIT_CORRUPT','Decision history must begin with intent');
      if (previous) {
        if(!transitions[previous.status].has(r.status)) fail('AUDIT_CORRUPT','Invalid audit state transition');
        for(const field of ['parentId','policyRevision','modelId','provider','model','effort','kind','candidateId']) if(previous[field]!==r[field]) fail('AUDIT_CORRUPT','Audit decision identity changed');
        if(previous.childId!==undefined && previous.childId!==r.childId && r.status!=='unknown') fail('AUDIT_CORRUPT','Audit child identity changed');
      }
      decisions.set(r.decisionId, r);
    }
    for (const r of decisions.values()) {
      const s = this.state(r.parentId);
      if (['accepted','settled','unknown'].includes(r.status)) s.created++;
      if (['intent','accepted','unknown'].includes(r.status)) s.paused = true;
    }
  }
  reserve(id, modelId) {
    const s = this.state(id), l = this.limits;
    if (s.paused) fail('RECOVERY_REQUIRED', 'Previous child creation has unresolved state; use native status tools and reconcile before new routed work');
    if (s.pending >= l.maxPendingStarts) fail('PENDING_LIMIT', 'Too many child creations are pending');
    if (s.created + s.pending >= l.maxCreationsPerParent) fail('CREATION_LIMIT', 'Child creation limit reached for this parent Session');
    const count = [...s.active.values()].filter(v => v.modelId === modelId).length;
    if (count >= l.maxActivePerModel) fail('MODEL_CAPACITY', 'This model has no available child slot');
    const token = Object.freeze({}); s.pending++; s.active.set(token, { modelId, status: 'pending' });
    return { parentId: id, token, modelId };
  }
  accept(r, childId) { const s = this.state(r.parentId), v = s.active.get(r.token); if (!v || v.status !== 'pending') fail('RESERVATION_STATE', 'Invalid reservation'); s.pending--; s.created++; s.active.set(r.token, { ...v, status: 'active', childId }); }
  reject(r) { const s = this.state(r.parentId), v = s.active.get(r.token); if (v?.status === 'pending') s.pending--; s.active.delete(r.token); }
  unknown(r) { const s = this.state(r.parentId); s.paused = true; this.reject(r); }
  settle(id, childId) { const s = this.state(id); for (const [t,v] of s.active) if (v.childId === childId) s.active.delete(t); }
  pause(id) { this.state(id).paused = true; }
}
