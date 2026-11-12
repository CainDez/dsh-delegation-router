/** Shipped host code in an isolated Cordis context; no live profile, agents, or paid requests. */
import {createRequire,syncBuiltinESMExports} from 'node:module';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import childProcess from 'node:child_process';

import {createChildReaders,createLifecycleHandlers} from '../src/lifecycle.js';
if(!process.argv[2])throw Error('Pass the matching installed DSH package.json path');
const requireHost=createRequire(resolve(process.argv[2]));
// Process-local fail-closed boundary, installed before importing host libraries.
// No credentials, profile, live LLM, or Agent creation/loading service is connected.
const sideEffects={networkAttempts:0,processAttempts:0};
const restores=[];
function block(object,key,counter){
 const original=object[key];
 object[key]=()=>{sideEffects[counter]++;throw Error('Forbidden detached preflight side effect: '+key);};
 restores.push(()=>{object[key]=original;});
}
block(globalThis,'fetch','networkAttempts');
for(const mod of [http,https])for(const key of ['request','get'])block(mod,key,'networkAttempts');
for(const key of ['connect','createConnection'])block(net,key,'networkAttempts');
block(net.Socket.prototype,'connect','networkAttempts');block(tls,'connect','networkAttempts');
block(dgram.Socket.prototype,'send','networkAttempts');
for(const key of ['exec','execSync','execFile','execFileSync','spawn','spawnSync','fork'])block(childProcess,key,'processAttempts');
syncBuiltinESMExports();

const load=name=>import(pathToFileURL(requireHost.resolve(name)).href);
let ctx;
try {
const {Context}=await load('@deepseek-ai/cordis');
const {Session,SESSION_FORMAT_VERSION}=await load('@deepseek-ai/dsh-session');
const {SessionQueryEngine,readColdSessionLog}=await load('@deepseek-ai/dsh-session-query');
const {resolveChildAgentOptions}=await load('@deepseek-ai/dsh-subagent');
const {createLifecycleEmitter}=await import(new URL('./types/lifecycle.js',pathToFileURL(requireHost.resolve('@deepseek-ai/dsh-subagent'))).href);
const parent={id:'detached-root',options:{},session:{header:{id:'detached-root'},requestHeader:()=>({config:{provider:'p',model:'m',reasoningEffort:'high'}})}};
const header={version:SESSION_FORMAT_VERSION,id:'detached-child',createdAt:1,isSeeded:false,origin:'subagent',parentSession:parent.id};
const events=[{type:'turn/start',seq:0,time:1,data:{turn:1}},{type:'request/header',seq:1,time:2,data:{header:{config:{provider:'p',model:'m',reasoningEffort:'low'}},reason:'initial'}},{type:'turn/end',seq:2,time:3,data:{turn:1,reason:{kind:'completed'}}}];
const live=new Map(),stored=new Map([[header.id,{header,events}]]);let closes=0;
const persistence={identity:{},async stat(id){const value=stored.get(id);return value?{header:value.header,revision:JSON.stringify(value.events)}:undefined;},async open(id,mode){assert.equal(mode,'read');const value=stored.get(id);return {header:value.header,inheritedEventCount:0,async read(){return {events:structuredClone(value.events),eventState:'owned'};},async close(){closes++;}};}};
ctx=new Context();
ctx.provide('sessions',{get:id=>live.get(id),prepare:(id,options)=>Session.create(id,options.seed,options.meta,options.inheritedEventCount)});
ctx.provide('sessionPersistence',persistence);
const query=new SessionQueryEngine(ctx);
const readers=createChildReaders({observeSession:(id,options)=>query.observeSession(id,options)});
const child=Session.create(header.id,events,header,0);live.set(child.id,child);
assert.deepEqual(await readers.readChildRoute(parent,child.id),{provider:'p',model:'m',effort:'low'});
await assert.rejects(readers.readCompletion(parent,child.id),{code:'CHILD_NOT_SETTLED'});
const settled=[],handlers=createLifecycleHandlers({getSession:id=>live.get(id),...readers,settle:(...args)=>settled.push(args)});
// rc.1/rc.2 SubagentRunInfo shape; manually dispatched, never a real manager activation.
const info=Object.freeze({runId:'detached-lifecycle-run',provider:'local',parentSessionId:parent.id,id:child.id,local:true});
const carrier={agent:parent},dispatched=[],pending=[],warnings=[];
assert.equal(typeof createLifecycleEmitter,'function','Host must expose createLifecycleEmitter; no version skip');
const dispatch={events:{dispatch:(mode,args)=>{
 assert.equal(mode,'emit');assert.equal(args.length,3);assert.equal(args[0],carrier);
 assert.ok(['subagent/start','subagent/end'].includes(args[1]));
 dispatched.push({name:args[1],info:args[2]});
 const handler=args[1]==='subagent/start'?handlers.start:handlers.end;
 return [(...values)=>{assert.equal(values.length,1);assert.equal(values[0],args[2]);const result=handler(...values);pending.push(Promise.resolve(result));return result;}];
}},logger:{warn:message=>warnings.push(message)}};
const emit=createLifecycleEmitter(dispatch,root=>{assert.equal(root,parent);return carrier;});
emit('subagent/start',info,parent);
// Mirror end-after-release ordering only by removing the detached Session from our fake registry.
live.delete(child.id);
emit('subagent/end',Object.freeze({...info,stopReason:'completed'}),parent);
await Promise.all(pending);assert.deepEqual(warnings,[]);
assert.deepEqual(dispatched,[{name:'subagent/start',info},{name:'subagent/end',info:{...info,stopReason:'completed'}}]);
assert.deepEqual(settled,[[parent.id,child.id,{source:'subagent/end',runId:info.runId}]]);
assert.deepEqual(await readers.readChildRoute(parent,child.id),{provider:'p',model:'m',effort:'low'});
assert.equal((await readers.readCompletion(parent,child.id)).reason,'completed');
await assert.rejects(readers.readChildRoute({...parent,id:'foreign'},child.id),{code:'CHILD_SCOPE'});
stored.set(child.id,{header,events:events.slice(0,-1)});
const cold=await readColdSessionLog(persistence,child.id);
assert.equal(cold.events.at(-1).data.reason.kind,'interrupted');
assert.equal(stored.get(child.id).events.length,2);
await assert.rejects(readers.readCompletion(parent,child.id),{code:'CHILD_NOT_SETTLED'});
assert.equal(resolveChildAgentOptions(parent,{provider:'p',model:'m'},1).reasoningEffort,'high');
assert.equal(resolveChildAgentOptions(parent,{provider:'q',model:'n'},1).reasoningEffort,undefined);
assert.ok(closes>0,'Actual SessionQuery cold reads must close persistence handles');
assert.deepEqual(sideEffects,{networkAttempts:0,processAttempts:0});
console.log(JSON.stringify({hostVersion:JSON.parse(await readFile(resolve(process.argv[2]),'utf8')).version,shippedSessionQuery:true,shippedLifecycleEmitter:true,detachedLifecyclePayloadDispatch:true,detachedEndAfterSessionRemoval:true,singlePayloadCallback:true,realManagerActivation:false,coldOwnership:true,crossParentRejected:true,syntheticInterruptedRejected:true,nativeSameRouteEffortInheritanceConfirmed:true,readHandlesClosed:closes,profileChanged:false,agentsCreated:0,...sideEffects,paidCalls:0},null,2));
} finally {
 await ctx?.fiber.dispose();
 for(const restore of restores.reverse())restore();
 syncBuiltinESMExports();
}
