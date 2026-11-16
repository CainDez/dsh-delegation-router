import {SubagentRouter,normalizeRequest} from './runtime.js';
import {createHash} from 'node:crypto';
import {fail} from './errors.js';
import {decisionSnapshot} from './lifecycle.js';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Owns one audit lock and stable call receipts across UI policy revisions. */
export class LiveRouter {
  constructor({readConfig,createJournal,...dependencies}) {
    this.readConfig=readConfig;this.createJournal=createJournal;this.dependencies=dependencies;
    this.inFlight=0;this.calls=new Map();this.latest=new Map();this.closed=false;
  }
  snapshot(){const config=this.readConfig();return {config,key:digest(config),revision:digest(config.policy)};}
  pending(){return [...this.latest.values()].some(status=>status==='intent'||status==='accepted'||status==='unknown');}
  status(){
    try {
      const {config,key,revision}=this.snapshot();
      return {enabled:config.policy.enabled,configuredRevision:revision,activeRevision:this.runtime?.revision??null,configurationPending:!!this.runtime&&this.key!==key,switchingBlocked:this.inFlight>0||this.pending(),inFlight:this.inFlight};
    }catch(error){return {enabled:false,configurationError:{code:error.code??'INVALID_CONFIG',message:error.message},activeRevision:this.runtime?.revision??null,inFlight:this.inFlight};}
  }
  decisions(parent,options={}){
    // A status read must not instantiate a runtime or acquire a journal lock.
    return this.runtime ? this.runtime.decisions(parent,options) : decisionSnapshot(parent,[],options);
  }
  validateUpdate(config){
    if(!this.runtime)return;
    const key=digest(config);
    if(key===this.key)return;
    if(config.auditFile!==this.auditFile)fail('AUDIT_PATH_RELOAD_REQUIRED','Audit journal changes require disabling and reviewing the plugin before a fresh load');
    if(config.policy.enabled&&(this.inFlight||this.pending()))fail('CONFIG_BUSY','Wait for existing preparation and child work to settle before changing an enabled policy');
  }
  ensure(recovery=false){
    if(this.closed)fail('ROUTER_DISABLED','Router has been disposed');
    const {config,key}=this.snapshot();
    if(!config.policy.enabled&&!recovery)fail('ROUTER_DISABLED','Child router is disabled');
    if(recovery&&this.runtime)return this.runtime;
    if(this.runtime&&key===this.key)return this.runtime;
    if(this.journal&&config.auditFile!==this.auditFile)fail('AUDIT_PATH_RELOAD_REQUIRED','Review outstanding children and reload the plugin before changing the audit journal');
    if(this.inFlight||this.pending())fail('CONFIG_BUSY','Configuration is saved but old work is still pending; wait for settlement before starting under the new revision');
    const fresh=!this.journal;
    if(fresh){this.journal=this.createJournal(config.auditFile);this.auditFile=config.auditFile;}
    try {
      const records=this.journal.load();
      const latest=new Map();for(const record of records)latest.set(record.decisionId,record.status);
      const facade={load:()=>this.journal.load(),append:record=>{this.journal.append(record);this.latest.set(record.decisionId,record.status);},close(){}};
      const readAuthorization=parent=>{
        if(this.snapshot().key!==key)fail('STALE_CONFIG','Routing configuration changed during preparation; inspect the saved configuration before retrying');
        return this.dependencies.readAuthorization(parent);
      };
      const runtime=new SubagentRouter({...this.dependencies,readAuthorization,config:config.policy,journal:facade});
      this.runtime?.close();
      this.latest=latest;this.runtime=runtime;this.key=key;
      return runtime;
    }catch(error){if(fresh){this.journal.close();this.journal=undefined;this.auditFile=undefined;}throw error;}
  }
  run(parent,args,exec){
    const request=normalizeRequest(args);
    if(typeof exec.callId!=='string'||!exec.callId)fail('INVALID_REQUEST','A host callId is required');
    const key=parent.id+':'+exec.callId;const fingerprint=digest(request);
    const previous=this.calls.get(key);
    if(previous){if(previous.fingerprint!==fingerprint)fail('CALL_ID_REUSE','Call identity reused with different arguments');return previous.promise;}
    if(this.calls.size>=10000)fail('CALL_HISTORY_LIMIT','Reload only after children and audit decisions have been reconciled');
    const runtime=this.ensure();this.inFlight++;
    const promise=Promise.resolve().then(()=>runtime.run(parent,request,exec)).finally(()=>{this.inFlight--;});
    this.calls.set(key,{fingerprint,promise});return promise;
  }
  settle(parentId,childId,evidence){if(!this.closed)this.runtime?.settle(parentId,childId,evidence);}
  reconcile(parentId,childId,evidence){return this.ensure(true).reconcileCompleted(parentId,childId,evidence);}
  close(){if(this.closed)return;this.closed=true;try{this.runtime?.close();}finally{this.journal?.close();}}
}
