import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { selectRoute } from '../src/policy.js';

const candidate=(id,extra={})=>({id,name:'Candidate '+id,provider:'provider-'+id,model:'model-'+id,effort:'low',description:'Fixed selection',...extra});
const config=(extra={})=>({schemaVersion:3,enabled:true,candidates:[candidate('a'),candidate('b')],defaultCandidateId:'a',...extra});
const meta=(extra={})=>({reasoning:{efforts:['low','high']},inputModalities:['text'],context:8000,...extra});
const catalog=()=>new Map([['a',meta()],['b',meta()]]);
const auth=[{provider:'provider-a',model:'model-a'},{provider:'provider-b',model:'model-b'}];
const route=(cfg=config(),input={})=>selectRoute(cfg,{facts:{payload:{inputModalities:['text'],context:{tokens:100}}},catalog:catalog(),authorizedRoutes:auth,...input});
const invalid=fn=>assert.throws(fn,{code:'INVALID_CONFIG'});
const noRoute=fn=>assert.throws(fn,{code:'NO_ROUTE'});

test('the absent entry returns a fresh frozen empty v3 configuration and normalizes idempotently',()=>{
  const empty=normalizeConfig();assert.equal(empty.schemaVersion,3);assert.equal(empty.enabled,false);assert.deepEqual(empty.candidates,[]);
  assert.equal(Object.hasOwn(empty,'defaultCandidateId'),false);assert.equal(empty.limits.metadataTimeoutMs,5000);
  assert.ok(Object.isFrozen(empty));assert.deepEqual(normalizeConfig(empty),empty);
  assert.notEqual(normalizeConfig().candidates,normalizeConfig().candidates);
  assert.equal(Object.hasOwn(empty,'teams'),false);
  const raw=config(),normalized=normalizeConfig(raw);raw.candidates[0].name='changed';
  assert.equal(normalized.candidates[0].name,'Candidate a');assert.ok(Object.isFrozen(normalized.candidates[0]));
  assert.deepEqual(normalizeConfig(normalized),normalized);
  assert.deepEqual(Object.keys(normalized).sort(),['schemaVersion','enabled','candidates','defaultCandidateId','limits'].sort());
});
test('every explicit source including {} must declare schemaVersion 3',()=>{
  invalid(()=>normalizeConfig({}));
  for(const raw of [{schemaVersion:1},{schemaVersion:2},{schemaVersion:4},{schemaVersion:'3'},{schemaVersion:null},{enabled:false},{candidates:[]}]) invalid(()=>normalizeConfig(raw));
  assert.deepEqual(normalizeConfig({schemaVersion:3}),normalizeConfig());
  invalid(()=>normalizeConfig({...config(),unexpected:[]}));
});
test('enabled configurations require a valid defaultCandidateId and at least one candidate',()=>{
  invalid(()=>normalizeConfig({...config(),defaultCandidateId:undefined}));
  invalid(()=>normalizeConfig(config({defaultCandidateId:'missing'})));
  invalid(()=>normalizeConfig(config({candidates:[]})));
  const disabled=normalizeConfig({schemaVersion:3,candidates:[candidate('a')]});
  assert.equal(disabled.enabled,false);assert.equal(Object.hasOwn(disabled,'defaultCandidateId'),false);
  invalid(()=>normalizeConfig({schemaVersion:3,candidates:[candidate('a')],defaultCandidateId:'missing'}));
  assert.equal(normalizeConfig({schemaVersion:3,candidates:[candidate('a')],defaultCandidateId:'a'}).defaultCandidateId,'a');
});
test('strict candidate schema rejects unknown keys, malformed text, duplicate ids and fake efforts',()=>{
  for(const extra of [{unknown:true},{schemaVersion:1},{enabled:'yes'},{candidates:null},{limits:null},{limits:{unknown:1}},{limits:{maxPendingStarts:0}},{limits:{metadataTimeoutMs:1.1}},{limits:{maxCreationsPerParent:Infinity}},{candidates:[candidate('a'),candidate('a')]}]) invalid(()=>normalizeConfig(config(extra)));
  for(const extra of [{unknown:1},{id:'bad id'},{id:'-bad'},{name:''},{name:' spaced'},{name:'x'.repeat(121)},{name:'line\nline'},{provider:''},{model:'m'.repeat(201)},{effort:''},{effort:'default'},{effort:undefined},{effort:123},{description:'x'.repeat(1001)},{description:'line\nline'}]) invalid(()=>normalizeConfig(config({candidates:[candidate('a',extra)]})));
  const normalized=normalizeConfig(config({candidates:[candidate('a',{effort:null,description:''})]}));
  assert.equal(normalized.candidates[0].effort,null);assert.equal(normalized.candidates[0].description,'');
  assert.deepEqual(Object.keys(normalized.candidates[0]).sort(),['id','name','provider','model','effort','description'].sort());
});
test('descriptor-first checks reject getters, exotic prototypes, hidden fields, pollution and cycles',()=>{
  let invoked=0;const getter=Object.defineProperty({},'candidates',{enumerable:true,get(){invoked++;return [];}});invalid(()=>normalizeConfig(getter));
  const nested=config();Object.defineProperty(nested.candidates[0],'name',{get(){invoked++;return 'bad';}});invalid(()=>normalizeConfig(nested));
  invalid(()=>normalizeConfig(JSON.parse('{"__proto__":{"polluted":true}}')));invalid(()=>normalizeConfig(Object.create({enabled:true})));
  invalid(()=>normalizeConfig({...config(),[Symbol('s')]:1}));invalid(()=>normalizeConfig(Object.defineProperty(config(),'hidden',{value:1})));
  const cycle=config();cycle.candidates.push(cycle);invalid(()=>normalizeConfig(cycle));
  const sparse=config();delete sparse.candidates[0];invalid(()=>normalizeConfig(sparse));
  invalid(()=>normalizeConfig(config({candidates:Array.from({length:129},(_,i)=>candidate('p'+i))})));
  let deep={};for(let i=0;i<40;i++)deep={nested:deep};invalid(()=>normalizeConfig(deep));assert.equal(invoked,0);assert.equal({}.polluted,undefined);
});
test('default and explicit candidates select exactly one immutable fixed route',()=>{
  assert.deepEqual(route(),{candidateId:'a',provider:'provider-a',model:'model-a',effort:'low',reason:'default-candidate'});
  const selected=route(config(),{proposal:{candidateId:'b'}});assert.equal(selected.candidateId,'b');assert.equal(selected.reason,'explicit-candidate');
  assert.deepEqual(Object.keys(selected).sort(), ['candidateId','provider','model','effort','reason'].sort());
  assert.equal(route(config(),{facts:{assessment:{taskType:'review',complexity:'hard'}}}).candidateId,'a');
});
test('unknown, unauthorized or unavailable chosen candidates never fall back to an eligible default',()=>{
  noRoute(()=>route(config(),{proposal:{candidateId:'missing'}}));
  noRoute(()=>route(config(),{proposal:{candidateId:'b'},authorizedRoutes:[auth[0]]}));
  noRoute(()=>route(config(),{proposal:{candidateId:'b'},catalog:new Map([['a',meta()]])}));
  noRoute(()=>route(config(),{catalog:new Map([['b',meta()]])}));
  noRoute(()=>route(config(),{authorizedRoutes:[auth[1]]}));
  assert.throws(()=>route(config({enabled:false})),{code:'ROUTER_DISABLED'});
});
test('proposals accept only a data-only candidateId, not raw route overrides or unknown fields',()=>{
  for(const proposal of [null,{},'b',{candidateId:'b',effort:'high'},{candidateId:'b',provider:'p'},{unexpected:'b'},Object.create({candidateId:'b'})]) assert.throws(()=>route(config(),{proposal}),{code:'INVALID_PROPOSAL'});
  let called=false;const proposal=Object.defineProperty({},'candidateId',{enumerable:true,get(){called=true;return 'b';}});
  assert.throws(()=>route(config(),{proposal}),{code:'INVALID_PROPOSAL'});assert.equal(called,false);
});
test('the same model can have multiple fixed effort candidates without inferred diversity or fallback',()=>{
  const candidates=[candidate('a'),candidate('high',{provider:'provider-a',model:'model-a',effort:'high'})];
  const cfg=config({candidates}),input={catalog:new Map(candidates.map(c=>[c.id,meta()])),proposal:{candidateId:'high'}};
  assert.equal(route(cfg,input).effort,'high');
  noRoute(()=>route(cfg,{...input,authorizedRoutes:[{...auth[0],efforts:['low']}]}));
  const limited=new Map([['a',meta()],['high',meta({reasoning:{efforts:['low']}})]]);
  noRoute(()=>route(cfg,{...input,catalog:limited}));
});
test('authorization is mandatory, exact provider/model, and respects effort constraints',()=>{
  assert.throws(()=>route(config(),{authorizedRoutes:undefined}),{code:'INVALID_AUTHORIZATION'});
  for(const authorizedRoutes of [[],[{modelId:'a'}],[{model:'model-a'}],[{provider:'PROVIDER-A',model:'model-a'}],[{...auth[0],effort:'high'}],[{...auth[0],efforts:[]}]]) noRoute(()=>route(config(),{authorizedRoutes}));
  assert.equal(route(config(),{authorizedRoutes:[{...auth[0],efforts:['low']}]}).candidateId,'a');
});
test('effort null requires explicit empty capability metadata, never unknown or malformed data',()=>{
  const cfg=config({candidates:[candidate('a',{effort:null})]});
  assert.equal(route(cfg,{catalog:new Map([['a',meta({reasoning:{efforts:[]}})]])}).effort,null);
  for(const metadata of [undefined,null,{},meta({reasoning:undefined}),meta({reasoning:{}}),meta({reasoning:{efforts:null}}),meta(),meta({reasoning:{efforts:['']}}),meta({reasoning:{efforts:['default']}})]) noRoute(()=>route(cfg,{catalog:new Map([['a',metadata]])}));
  noRoute(()=>route(config(),{catalog:new Map([['a',meta({reasoning:{efforts:[]}})]])}));
  noRoute(()=>route(cfg,{catalog:new Map([['a',meta({reasoning:{efforts:[]}})]]),authorizedRoutes:[{...auth[0],effort:'low'}]}));
});
test('capability identity, modalities and finite context capacity stay authoritative',()=>{
  for(const metadata of [meta({provider:'other'}),meta({model:'other'}),meta({inputModalities:['image']}),meta({context:99}),meta({context:undefined}),meta({context:NaN}),meta({reasoning:{efforts:['low','low']}})]) noRoute(()=>route(config(),{catalog:new Map([['a',metadata],['b',meta()]])}));
  for(const payload of [{inputModalities:'text'},{context:{tokens:-1}},{context:{tokens:Infinity}}]) assert.throws(()=>route(config(),{facts:{payload}}),{code:'INVALID_FACTS'});
  const raw=config(),copy=structuredClone(raw);route(raw);assert.deepEqual(raw,copy);
});
