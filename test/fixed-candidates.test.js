import test from 'node:test';
import assert from 'node:assert/strict';
import { SubagentRouter } from '../src/runtime.js';
import { MemoryJournal } from '../src/journal.js';

const candidate={id:'chosen',name:'User choice',provider:'worker-provider',model:'worker-model',effort:'high'};
const metadata={inputModalities:['text'],context:{contextWindow:100000},reasoning:{efforts:['low','high']}};
const request={prompt:'A bounded delegated task',description:'Worker task'};
function fixture(overrides={}) {
  const parent={id:'root',options:{provider:'main-provider',model:'main-model',reasoningEffort:'low'},session:{header:{origin:'root'}}};
  const calls=[],resolutions=[],prepared=[],journal=new MemoryJournal();
  const config={schemaVersion:3,enabled:true,candidates:[{...candidate}],defaultCandidateId:candidate.id};
  const router=new SubagentRouter({config,journal,
    readAuthorization:()=>[{provider:candidate.provider,model:candidate.model}],
    resolveModel:async(provider,model)=>{resolutions.push([provider,model]);return metadata;},
    preflight:async options=>{prepared.push(options);},
    invokeNative:async(args,_exec,beforeDispatch)=>{beforeDispatch();calls.push(args);return {kind:'activation',name:'worker',childId:'child-'+calls.length};},
    ...overrides});
  return {parent,router,calls,resolutions,prepared,journal,config};
}
const exec=callId=>({callId,signal:new AbortController().signal});

test('candidate selection never derives worker identity or effort from the main model',async()=>{
  const f=fixture(),before=structuredClone(f.parent);
  Object.freeze(f.parent.options);Object.freeze(f.parent);
  const result=await f.router.run(f.parent,request,exec('fixed'));
  assert.deepEqual(result.selected,{provider:candidate.provider,model:candidate.model,effort:'high'});
  assert.equal(result.candidateId,'chosen');assert.equal(result.routingReason,'default-candidate');
  assert.deepEqual(f.parent,before);assert.deepEqual(f.resolutions,[[candidate.provider,candidate.model]]);
  assert.equal(f.calls.length,1);assert.equal(f.prepared.length,1);
  assert.ok(f.prepared.every(Object.isFrozen));
  assert.equal(Object.hasOwn(result,'subagentId'),false);
});

test('fixed plans are detached frozen data and cannot be rebound through caller configuration',async()=>{
  const f=fixture();const plan=await f.router.plan(f.parent,request);
  for(const value of [plan,plan.route,plan.options,plan.request])assert.ok(Object.isFrozen(value));
  assert.equal(Object.hasOwn(plan,'parentRoute'),false);
  f.config.candidates[0].model='external-change';f.parent.options.model='different-main';
  assert.equal(plan.options.model,candidate.model);assert.equal(f.router.config.candidates[0].model,candidate.model);
  assert.doesNotThrow(()=>f.router.validateSelected(f.parent,plan));
});

test('main model changes during preflight and native preparation leave the authorized candidate fixed',async()=>{
  let f;
  f=fixture({preflight:async()=>{f.parent.options={provider:'other',model:'other-main'};},
    invokeNative:async(args,_exec,fence)=>{f.parent.options={provider:'another',model:'new-main'};fence();f.calls.push(args);return {kind:'activation',name:'worker',childId:'child'};}});
  const result=await f.router.run(f.parent,request,exec('changes'));
  assert.deepEqual(result.selected,{provider:candidate.provider,model:candidate.model,effort:'high'});
  assert.equal(f.calls[0].model,candidate.model);
});

test('different main agents use the same explicit candidate without a parent-model cache',async()=>{
  const f=fixture(),other={id:'other-root',options:{provider:'x',model:'y'},session:{header:{origin:'root'}}};
  const [a,b]=await Promise.all([f.router.run(f.parent,request,exec('one')),f.router.run(other,request,exec('two'))]);
  assert.deepEqual(a.selected,b.selected);assert.equal(f.calls.length,2);
  assert.ok(f.journal.load().every(row=>row.candidateId==='chosen'&&row.modelId===JSON.stringify([candidate.provider,candidate.model])));
});

test('authorization remains authoritative when changing the main model changes the allowed routes',async()=>{
  let allowed=true;const f=fixture({readAuthorization:()=>allowed?[{provider:candidate.provider,model:candidate.model}]:[],preflight:async()=>{allowed=false;}});
  await assert.rejects(f.router.run(f.parent,request,exec('revoked')),{code:'STALE_AUTHORIZATION'});
  assert.equal(f.calls.length,0);assert.deepEqual(f.journal.load(),[]);
});
