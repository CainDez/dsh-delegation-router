import test from 'node:test';
import assert from 'node:assert/strict';
import {createChildReaders,createLifecycleHandlers,decisionSnapshot,routeEvidence} from '../src/lifecycle.js';
const parent={id:'root',session:{header:{id:'root'}}};
const header={id:'child',origin:'subagent',parentSession:'root'};
const events=[{seq:0,type:'request/header',data:{header:{config:{provider:'p',model:'m',reasoningEffort:'low'}}}},{seq:1,type:'turn/start',data:{turn:1}},{seq:2,type:'turn/end',data:{turn:1,reason:{kind:'completed'}}}];
function fixture(patch={}) {
 let disposed=0,options;
 const source={source:'prepared',header,inheritedEventCount:0,events,...patch,[Symbol.dispose](){disposed++;}};
 const readers=createChildReaders({observeSession:async(id,opt)=>{assert.equal(id,'child');options=opt;return source;}});
 return {readers,source,get disposed(){return disposed;},get options(){return options;}};
}
test('cold persisted child route is read from first own request, with lease released',async()=>{
 const f=fixture({inheritedEventCount:1,events:[{...events[0],data:{header:{config:{provider:'parent',model:'parent'}}}},...events,{...events[0],seq:3,data:{header:{config:{provider:'later',model:'later'}}}}]});
 assert.deepEqual(await f.readers.readChildRoute(parent,'child'),{provider:'p',model:'m',effort:'low'});
 assert.equal(f.disposed,1);assert.equal(f.options.projectionMode,'none');
});
test('cross-parent, wrong id and non-subagent observations reject and release leases',async()=>{
 for(const patch of [{parentSession:'other'},{id:'other'},{origin:'user'}]){
  const f=fixture({header:{...header,...patch}});
  await assert.rejects(f.readers.readChildRoute(parent,'child'),{code:'CHILD_SCOPE'});assert.equal(f.disposed,1);
 }
});
test('missing actual request never falls back to selected or Agent creation options',async()=>{
 const f=fixture({events:[]});assert.equal(await f.readers.readChildRoute(parent,'child'),null);
});
test('only root can inspect and evidence reader failures remain explicit',async()=>{
 const f=fixture();await assert.rejects(f.readers.readChildRoute({id:'child',session:{header}},'child'),{code:'ROOT_ONLY'});
 await assert.rejects(createChildReaders({}).readChildRoute(parent,'child'),{code:'CHILD_EVIDENCE_UNAVAILABLE'});
 await assert.rejects(createChildReaders({observeSession:async()=>{throw Error('storage failure');}}).readChildRoute(parent,'child'),/storage failure/);
});
test('cancellation after observation releases the lease',async()=>{
 const f=fixture();const controller=new AbortController();controller.abort();
 await assert.rejects(f.readers.readChildRoute(parent,'child',controller.signal));assert.equal(f.disposed,1);
});
test('end settles after BOTH live Agent and Session registries have disposed the child',async()=>{
 let resident={header};const settled=[];
 const handlers=createLifecycleHandlers({getAgent:()=>resident?{session:resident}:undefined,getSession:()=>resident,settle:(...args)=>settled.push(args)});
 handlers.start({id:'child',runId:'epoch',local:true});resident=undefined;
 await handlers.end({id:'child',runId:'epoch',local:true,stopReason:'error'});
 assert.deepEqual(settled,[['root','child',{source:'subagent/end',runId:'epoch'}]]);
});
test('late event with no captured start uses durable ownership, not a dispatch carrier argument',async()=>{
 const f=fixture(),settled=[];
 const handlers=createLifecycleHandlers({...f.readers,settle:(...args)=>settled.push(args)});
 await handlers.end({id:'child',runId:'epoch',local:true}, {id:'forged'});
 assert.equal(settled[0][0],'root');assert.equal(f.disposed,1);
});
test('stale epoch does not consume newer start and nonlocal payload cannot settle',async()=>{
 const settled=[];const h=createLifecycleHandlers({getSession:()=>({header}),settle:(...args)=>settled.push(args)});
 h.start({id:'child',runId:'new',local:true});
 await h.end({id:'child',runId:'old',local:true});await h.end({id:'child',runId:'new',local:false});
 assert.equal(settled.length,0);await h.end({id:'child',runId:'new',local:true});assert.equal(settled.length,1);
});
test('lookup/settlement/logger errors are contained without fabricating a parent',async()=>{
 const errors=[];const h=createLifecycleHandlers({readChildOwner:async()=>{throw Error('missing');},settle:()=>assert.fail('must not settle'),onError:(...x)=>{errors.push(x);throw Error('logger');}});
 await h.end({id:'child',runId:'e',local:true});assert.equal(errors[0][1],undefined);assert.equal(errors[0][2],'child');
});
test('reconciliation proof requires persisted nonresident closed own turn',async()=>{
 const f=fixture();assert.deepEqual(await f.readers.readCompletion(parent,'child'),{source:'persisted-turn-end',parentId:'root',childId:'child',startSeq:1,endSeq:2,reason:'completed'});
 for(const patch of [{events:[events[0],events[1],{...events[2],data:{turn:1,reason:{kind:'interrupted'}}}]},{events:[events[0],events[1],{...events[2],data:{turn:1,reason:{kind:'unknown'}}}]},{source:'live'},{events:events.slice(0,-1)},{events:[...events,{seq:3,type:'inbox/enqueue',data:{}}]},{inheritedEventCount:events.length},{events:[events[0],events[1],{...events[2],data:{turn:2,reason:{kind:'completed'}}}]}]){
  const invalid=fixture(patch);await assert.rejects(invalid.readers.readCompletion(parent,'child'),{code:'CHILD_NOT_SETTLED'});assert.equal(invalid.disposed,1);
 }
});
test('route evidence strips extras and never invokes route getters',()=>{
 assert.deepEqual(routeEvidence({provider:'p',model:'m',secret:'hide'}),{provider:'p',model:'m',effort:null});
 assert.equal(routeEvidence({get provider(){throw Error('getter');},model:'m'}),null);
});
test('async decision evidence is bounded, parent-scoped and independent of task success',async()=>{
 const base={parentId:'root',decisionId:'d',provider:'p',model:'m',effort:'low',policyRevision:'rev',kind:'subagent',presetId:'fast',childId:'child'};
 const records=[{...base,status:'accepted'},{...base,status:'settled'},{...base,parentId:'other',decisionId:'secret',status:'accepted'}];
 const cards=await decisionSnapshot(parent,records,{readChildRoute:async()=>({provider:'p',model:'m',effort:'low'})});
 assert.equal(cards.length,1);assert.equal(cards[0].settled,true);assert.equal(cards[0].presetId,'fast');assert.equal(cards[0].observed.model,'m');assert.equal(cards[0].accepted,true);
 await assert.rejects(decisionSnapshot(parent,records,{limit:101}),{code:'INVALID_REQUEST'});
});
test('unknown and unresolved recovered decisions cannot claim settlement',async()=>{
 const records=[{parentId:'root',decisionId:'d',status:'accepted',childId:'child',provider:'p',model:'m'}];
 const [card]=await decisionSnapshot(parent,records,{recovered:new Set(['d']),readChildRoute:async()=>{throw Error('missing');}});
 assert.equal(card.unknown,true);assert.equal(card.settled,false);assert.equal(card.observed,null);
});
