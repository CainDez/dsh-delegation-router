import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
const node='const schema=new Proxy(function(){return schema},{get(){return schema},apply(){return schema}}); export default schema; export const z=schema;';
const modules={
 '@deepseek-ai/cordis':'export class Service{static init=Symbol.for("route-evidence-init");constructor(ctx,name){this.ctx=ctx;ctx.set(name,this)}}',
 '@deepseek-ai/schemastery':node,
 '@deepseek-ai/cosmokit':'export const isVolatile=()=>false;',
 '@deepseek-ai/dsh-tools':'export const defineTool=x=>x;',
 '@deepseek-ai/dsh-tools/pipeline':'export class ToolExecutionPipeline{}',
 '@deepseek-ai/dsh-subagent':'export function parentAgentOptionsForDelegation(parent){return parent.session.requestHeader()?.config ?? parent.options}',
 zod:node
};
const hook=registerHooks({resolve(s,c,n){return Object.hasOwn(modules,s)?{url:'data:text/javascript,'+encodeURIComponent(modules[s]),shortCircuit:true}:n(s,c)}});
const {parentRouteSnapshot}=await import('../src/authorization.js');
const {default:Service}=await import('../src/plugin.js');
hook.deregister();
test('route snapshots expose only actual route fields, not credentials/options',()=>{
 const config={provider:'actual',model:'actual-model',reasoningEffort:'high',apiKey:'DO_NOT_EXPOSE',preset:'unchanged'};
 const parent={options:{provider:'old'},session:{requestHeader:()=>({config})}};
 assert.deepEqual(parentRouteSnapshot(parent),{provider:'actual',model:'actual-model',effort:'high'});
 assert.equal(JSON.stringify(parentRouteSnapshot(parent)).includes('DO_NOT_EXPOSE'),false);
});
test('delegation evidence reports concurrent parent-route changes rather than claiming unchanged',async()=>{
 let route={provider:'parent',model:'one',reasoningEffort:'low'};
 const parent={id:'root',session:{header:{origin:'root'},requestHeader:()=>({config:route})}};
 const ctx={set(){},get(){},agents:{get:()=>parent}};
 const service=new Service(ctx,{policy:{enabled:false}});
 service.policy={enabled:true};
 service.manager={run:async()=>{route={...route,model:'externally-changed'};return {kind:'activation',subagentId:'child'}}};
 const value=await service.runWithParentEvidence({}, {agent:parent});
 assert.equal(value.parentRouteUnchanged,false);assert.equal(value.parentRouteBefore.model,'one');assert.equal(value.parentRouteAfter.model,'externally-changed');
});
