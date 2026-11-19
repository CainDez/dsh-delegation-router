import { mkdtempSync, rmSync, readFileSync, readdirSync, cpSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
// Verify the explicit build artifact without installing it.
const archive=process.argv[2]?resolve(process.argv[2]):join(root,pkg.name.replace(/^@/,'').replace('/','-')+'-'+pkg.version+'.tgz');
function run(command,args,cwd) {
  const r=spawnSync(command,args,{cwd,encoding:'utf8'});
  if(r.status!==0) throw new Error(command+' failed: '+(r.error?.message ?? '')+'\n'+r.stdout+'\n'+r.stderr);
  return r.stdout;
}
const members=run('tar',['-tf',archive],root).trim().split(/\r?\n/);
if(members.some(p=>!p.startsWith('package/') || p.split('/').includes('..') || p.includes('\\'))) throw new Error('Unexpected archive member path');
const allowed=relative=>/^src\/[^/]+\.js$/.test(relative)||/^locale\/[^/]+\.json$/.test(relative)||
  ['assets/icon.svg','examples/candidates.json','package.json','cordis.patch.yml','client.js','README.md','LICENSE'].includes(relative);
assert.ok(members.every(member=>allowed(member.slice('package/'.length))),'Production package contains development or unexpected files');
const temp=mkdtempSync(join(tmpdir(),'dsh-router-pack-check-'));
try {
  run('tar',['-xzf',archive,'-C',temp],root);
  const cwd=join(temp,'package');
  assert.deepEqual(JSON.parse(readFileSync(join(cwd,'package.json'),'utf8')),pkg);
  for(const member of members) {
    const relative=member.slice('package/'.length);
    if(relative!=='package.json')assert.ok(readFileSync(join(cwd,relative)).equals(readFileSync(join(root,relative))),'Archive differs from source: '+relative);
  }
  for(const relative of ['src/plugin.js','src/router-service.js','src/host-compatibility.js','client.js','cordis.patch.yml','assets/icon.svg'])assert.ok(existsSync(join(cwd,relative)),'Missing runtime entry: '+relative);
  for(const relative of ['test','scripts'])assert.equal(existsSync(join(cwd,relative)),false,'Development payload was shipped: '+relative);
  // Add external QA only AFTER checking the untouched production payload. Tests
  // sit beside extracted src/client so their ../ imports test the archive, not checkout.
  cpSync(join(root,'test'),join(cwd,'test'),{recursive:true,errorOnExist:true,force:false});
  mkdirSync(join(cwd,'scripts'));
  cpSync(join(root,'scripts','check.js'),join(cwd,'scripts','check.js'),{errorOnExist:true,force:false});
  run(process.execPath,['scripts/check.js'],cwd);
  const testFiles=readdirSync(join(cwd,'test')).filter(name=>name.endsWith('.test.js')).sort().map(name=>'test/'+name);
  const tests=run(process.execPath,['--test',...testFiles],cwd);
  const counts=tests.split(/\r?\n/).filter(line=>/^[^a-zA-Z]*(tests|pass|fail|cancelled|skipped) [0-9]+$/.test(line));
  const bytes=readFileSync(archive);
  console.log(JSON.stringify({archive,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,members:members.length,productionHasDevelopmentPayload:false,externalQaAgainstExtractedCode:true,isolatedPackageTests:counts,installed:false},null,2));
} finally {
  // Only remove the exact absolute temporary directory allocated by this process.
  if(!temp.startsWith(join(tmpdir(),'dsh-router-pack-check-'))) throw new Error('Unexpected temporary target');
  rmSync(temp,{recursive:true,force:true});
}
