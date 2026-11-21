import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nativeCandidateId } from '../src/native-selection.js';

const policy = { defaultCandidateId: 'daily', candidates: [
  { id:'daily', provider:'zai', model:'glm', effort:'max' },
  { id:'hard', provider:'codex', model:'sol', effort:'high' },
  { id:'review', provider:'codex', model:'sol', effort:'xhigh' },
  { id:'plain', provider:'other', model:'text', effort:null },
] };

test('only a completely omitted native route asks for the preset default', () => {
  assert.equal(nativeCandidateId(policy, {}), undefined);
  assert.equal(nativeCandidateId(policy, {candidate_id:'hard'}), 'hard');
  assert.equal(nativeCandidateId(policy, {provider:'zai', model:'glm'}), 'daily');
  assert.equal(nativeCandidateId(policy, {provider:'other', model:'text'}), 'plain');
  assert.equal(nativeCandidateId(policy, {provider:'codex', model:'sol', reasoning_effort:'xhigh'}), 'review');
});

test('ambiguous, partial and unknown selections are errors rather than default or fallback', () => {
  for (const [request, code] of [
    [{provider:'codex', model:'sol'}, 'AMBIGUOUS_NATIVE_SELECTION'],
    [{provider:'codex', model:'sol', reasoning_effort:'max'}, 'NO_ROUTE'],
    [{provider:'foreign', model:'glm'}, 'NO_ROUTE'],
    [{candidate_id:'removed'}, 'NO_ROUTE'],
    [{candidate_id:'hard', provider:'codex'}, 'INVALID_NATIVE_SELECTION'],
    [{model:'sol'}, 'INVALID_NATIVE_SELECTION'],
    [{reasoning_effort:'high'}, 'INVALID_NATIVE_SELECTION'],
    [{provider:'codex', model:'sol', reasoning_effort:''}, 'INVALID_NATIVE_SELECTION'],
  ]) assert.throws(() => nativeCandidateId(policy, request), {code});
});
