import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { selectRoute } from '../src/policy.js';
import { createDefaultPresets, DEFAULT_PRESET_ID } from '../src/default-presets.js';

const preset=(id,extra={})=>({id,name:'Preset '+id,provider:'provider-'+id,model:'model-'+id,effort:'low',description:'Fixed selection',...extra});
const config=(extra={})=>({schemaVersion:2,enabled:true,presets:[preset('a'),preset('b')],defaultPreset:'a',...extra});
const meta=(extra={})=>({reasoning:{efforts:['low','high']},inputModalities:['text'],context:8000,...extra});
const catalog=()=>new Map([['a',meta()],['b',meta()]]);
const auth=[{provider:'provider-a',model:'model-a'},{provider:'provider-b',model:'model-b'}];
const route=(cfg=config(),input={})=>selectRoute(cfg,{facts:{payload:{inputModalities:['text'],context:{tokens:100}}},catalog:catalog(),authorizedRoutes:auth,...input});
const invalid=fn=>assert.throws(fn,{code:'INVALID_CONFIG'});
const noRoute=fn=>assert.throws(fn,{code:'NO_ROUTE'});

test('v2 defaults are frozen detached data and normalize idempotently',()=>{
  const empty=normalizeConfig();assert.equal(empty.schemaVersion,2);assert.equal(empty.enabled,false);assert.deepEqual(empty.presets,createDefaultPresets());
  assert.equal(empty.defaultPreset,DEFAULT_PRESET_ID);assert.deepEqual(normalizeConfig(empty),empty);
  assert.equal(Object.hasOwn(empty,'teams'),false);assert.equal(empty.limits.metadataTimeoutMs,5000);
  const raw=config(),normalized=normalizeConfig(raw);raw.presets[0].name='changed';
  assert.equal(normalized.presets[0].name,'Preset a');assert.ok(Object.isFrozen(normalized.presets[0]));
  assert.deepEqual(normalizeConfig(normalized),normalized);
  assert.deepEqual(Object.keys(normalized).sort(),['schemaVersion','enabled','presets','defaultPreset','limits'].sort());
});
test('only exact disabled-Team read alias is accepted and never re-emitted',()=>{
  const raw=config({teams:{enabled:false}}), canonical=normalizeConfig(config());
  assert.deepEqual(normalizeConfig(raw),canonical);assert.deepEqual(raw.teams,{enabled:false});
  assert.equal(Object.hasOwn(normalizeConfig(raw),'teams'),false);
  for(const teams of [undefined,null,{},false,true,[],{enabled:undefined},{enabled:0},{enabled:'false'},{enabled:false,unknown:1}]) invalid(()=>normalizeConfig(config({teams})));
  for(const enabled of [false,true]) assert.throws(()=>normalizeConfig(config({enabled,teams:{enabled:true}})),error=>error.code==='TEAM_ROUTING_REMOVED'&&/remove.*teams.*review/i.test(error.message));
  let reads=0;const teams=Object.defineProperty({},'enabled',{enumerable:true,get(){reads++;return true;}});
  invalid(()=>normalizeConfig(config({teams})));assert.equal(reads,0);
});
test('v1 fields and rules cannot be silently discarded or migrated',()=>{
  invalid(()=>normalizeConfig({schemaVersion:1,models:[]}));
  for(const field of ['models','rules','lanes','review','guidance','defaultModel']) invalid(()=>normalizeConfig({...config(),[field]:[]}));
});
test('enabled configurations require a valid explicit default, disabled defaults remain checked',()=>{
  invalid(()=>normalizeConfig({...config(),defaultPreset:undefined}));
  invalid(()=>normalizeConfig(config({defaultPreset:'missing'})));
  invalid(()=>normalizeConfig(config({presets:[]})));
  assert.equal(normalizeConfig({schemaVersion:2,presets:[preset('a')]}).enabled,false);
  invalid(()=>normalizeConfig({schemaVersion:2,presets:[preset('a')],defaultPreset:'missing'}));
});
test('strict preset schema rejects malformed text, duplicate ids, fake default and missing effort',()=>{
  for(const extra of [{unknown:true},{schemaVersion:1},{enabled:'yes'},{presets:null},{limits:null},{teams:null},{limits:{unknown:1}},{teams:{enabled:'yes'}},{limits:{maxPendingStarts:0}},{limits:{metadataTimeoutMs:1.1}},{limits:{maxCreationsPerParent:Infinity}},{presets:[preset('a'),preset('a')]}]) invalid(()=>normalizeConfig(config(extra)));
  for(const extra of [{unknown:1},{id:'bad id'},{name:''},{name:' spaced'},{name:'x'.repeat(121)},{name:'line\nline'},{provider:''},{model:'m'.repeat(201)},{effort:''},{effort:'default'},{effort:undefined},{effort:123},{description:'x'.repeat(1001)},{description:'line\nline'}]) invalid(()=>normalizeConfig(config({presets:[preset('a',extra)]})));
  assert.equal(normalizeConfig(config({presets:[preset('a',{effort:null,description:''})]})).presets[0].effort,null);
});
test('descriptor-first checks reject getters, exotic prototypes, hidden fields, pollution and cycles',()=>{
  let invoked=0;const getter=Object.defineProperty({},'presets',{enumerable:true,get(){invoked++;return [];}});invalid(()=>normalizeConfig(getter));
  const nested=config();Object.defineProperty(nested.presets[0],'name',{get(){invoked++;return 'bad';}});invalid(()=>normalizeConfig(nested));
  invalid(()=>normalizeConfig(JSON.parse('{"__proto__":{"polluted":true}}')));invalid(()=>normalizeConfig(Object.create({enabled:true})));
  invalid(()=>normalizeConfig({...config(),[Symbol('s')]:1}));invalid(()=>normalizeConfig(Object.defineProperty(config(),'hidden',{value:1})));
  const cycle=config();cycle.presets.push(cycle);invalid(()=>normalizeConfig(cycle));
  const sparse=config();delete sparse.presets[0];invalid(()=>normalizeConfig(sparse));
  invalid(()=>normalizeConfig(config({presets:Array.from({length:129},(_,i)=>preset('p'+i))})));
  let deep={};for(let i=0;i<40;i++)deep={nested:deep};invalid(()=>normalizeConfig(deep));assert.equal(invoked,0);assert.equal({}.polluted,undefined);
});
test('default and explicit presets select exactly one immutable route',()=>{
  assert.deepEqual(route(),{presetId:'a',provider:'provider-a',model:'model-a',effort:'low',reason:'default-preset'});
  const selected=route(config(),{proposal:{presetId:'b'}});assert.equal(selected.presetId,'b');assert.equal(selected.reason,'explicit-preset');
  for(const field of ['matchedRules','lane','laneFallback','review','modelId']) assert.equal(field in selected,false);
  assert.equal(route(config(),{facts:{assessment:{taskType:'review',complexity:'hard'}}}).presetId,'a');
});
test('unknown, unauthorized or unavailable chosen presets never fall back to an eligible default',()=>{
  noRoute(()=>route(config(),{proposal:{presetId:'missing'}}));
  noRoute(()=>route(config(),{proposal:{presetId:'b'},authorizedRoutes:[auth[0]]}));
  noRoute(()=>route(config(),{proposal:{presetId:'b'},catalog:new Map([['a',meta()]])}));
  noRoute(()=>route(config(),{catalog:new Map([['b',meta()]])}));
  noRoute(()=>route(config(),{authorizedRoutes:[auth[1]]}));
  assert.throws(()=>route(config({enabled:false})),{code:'ROUTER_DISABLED'});
});
test('proposals accept only a data-only presetId, not raw route overrides or old routing fields',()=>{
  for(const proposal of [null,{},'b',{presetId:'b',effort:'high'},{modelId:'b'},{presetId:'b',lane:'hard'},{presetId:'b',provider:'p'},Object.create({presetId:'b'})]) assert.throws(()=>route(config(),{proposal}),{code:'INVALID_PROPOSAL'});
  let called=false;const proposal=Object.defineProperty({},'presetId',{enumerable:true,get(){called=true;return 'b';}});
  assert.throws(()=>route(config(),{proposal}),{code:'INVALID_PROPOSAL'});assert.equal(called,false);
});
test('same model can have multiple fixed effort presets without inferred diversity or fallback',()=>{
  const presets=[preset('a'),preset('high',{provider:'provider-a',model:'model-a',effort:'high'})];
  const cfg=config({presets}),input={catalog:new Map(presets.map(p=>[p.id,meta()])),proposal:{presetId:'high'}};
  assert.equal(route(cfg,input).effort,'high');
  noRoute(()=>route(cfg,{...input,authorizedRoutes:[{...auth[0],efforts:['low']}]}));
  const limited=new Map([['a',meta()],['high',meta({reasoning:{efforts:['low']}})]]);
  noRoute(()=>route(cfg,{...input,catalog:limited}));
});
test('authorization is mandatory, exact provider/model, and respects effort constraints',()=>{
  assert.throws(()=>route(config(),{authorizedRoutes:undefined}),{code:'INVALID_AUTHORIZATION'});
  for(const authorizedRoutes of [[],[{modelId:'a'}],[{model:'model-a'}],[{provider:'PROVIDER-A',model:'model-a'}],[{...auth[0],effort:'high'}],[{...auth[0],efforts:[]}]]) noRoute(()=>route(config(),{authorizedRoutes}));
  assert.equal(route(config(),{authorizedRoutes:[{...auth[0],efforts:['low']}]}).presetId,'a');
});
test('effort null requires explicit empty capability metadata, never unknown or malformed data',()=>{
  const cfg=config({presets:[preset('a',{effort:null})]});
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
