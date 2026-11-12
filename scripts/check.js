import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { normalizeConfig } from '../src/config.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function files(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(resolve(dir,e.name)):[resolve(dir,e.name)]); }
for(const file of files(resolve(root,'src')).filter(p=>p.endsWith('.js'))) {
  const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'}); if(r.status!==0) throw new Error(r.stderr);
}
const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
for(const p of Object.values(pkg.exports).filter(p=>!p.includes('*'))) if(!existsSync(resolve(root,p))) throw new Error('Missing package export '+p);
for(const p of ['locale/en-US.json','locale/zh-CN.json']) JSON.parse(readFileSync(resolve(root,p),'utf8'));
const singleSample=JSON.parse(readFileSync(resolve(root,'examples/ui-glm.json'),'utf8'));
normalizeConfig(singleSample.ui);
if(singleSample.ui.enabled!==false)throw Error('Single sample must remain opt-in');
const presetSample=JSON.parse(readFileSync(resolve(root,'examples/presets.json'),'utf8'));
normalizeConfig(presetSample.ui);
if(presetSample.ui.enabled!==false||Object.hasOwn(presetSample.ui,'teams'))throw Error('Preset sample must remain opt-in without retired Team settings');
const defaults=normalizeConfig();
if(defaults.defaultPreset!=='default-high'||defaults.presets.map(p=>p.effort).join(',')!=='low,high,max'||defaults.presets.some(p=>p.modelSource!=='parent'))throw Error('Inherited Low/High/Max defaults missing');
if(!pkg.dsh.client.inject.includes('@deepseek-ai/dsh-api-remotes'))throw new Error('Native model catalog remote dependency missing');
const browser=readFileSync(resolve(root,'client.js'),'utf8');
if(!browser.includes("'remote.session'")||!browser.includes('this.ctx.remote.session.modelCatalog()'))throw new Error('Native catalog client binding missing');
if(!browser.includes('window.__ModuleLoader__.load')||!browser.includes("'dsh-delegation-router#delegation-router'"))throw new Error('Browser configuration companion missing');
const clientCheck=spawnSync(process.execPath,['--check',resolve(root,'client.js')],{encoding:'utf8'});
if(clientCheck.status!==0)throw new Error(clientCheck.stderr);
if(pkg.exports['./team-compat']||pkg.scripts['build:team'])throw Error('Retired Team surface must not be published');
console.log('Syntax, exports, locales and sample presets verified. No host installation performed.');
