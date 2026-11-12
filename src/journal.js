import { readFileSync, existsSync, mkdirSync, lstatSync, openSync, closeSync, fsyncSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute } from 'node:path';
import { fail } from './errors.js';
export class MemoryJournal {
  records = [];
  load() { return structuredClone(this.records); }
  append(record) { this.records.push(structuredClone(record)); }
  close() {}
}
/** Plugin-only audit journal. Does not edit DSH session files or store prompts. */
export class FileJournal {
  constructor(file) {
    if (!isAbsolute(file)) fail('AUDIT_PATH', 'auditFile must be an absolute per-profile path');
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    if (existsSync(file) && (!lstatSync(file).isFile() || lstatSync(file).isSymbolicLink())) fail('AUDIT_PATH', 'Audit target must be a regular non-symlink file');
    this.file = file; this.lock=file+'.lock'; this.owner=randomUUID(); this.closed=false;
    let fd;
    try { fd=openSync(this.lock,'wx',0o600); } catch(error) { if(error.code==='EEXIST') fail('AUDIT_LOCKED','Audit journal is already owned or has a crash lock; inspect before recovery'); throw error; }
    try { writeFileSync(fd,JSON.stringify({pid:process.pid,owner:this.owner})); fsyncSync(fd); } finally { closeSync(fd); }
    // Parsing is deliberately fail-closed, including a torn last record.
    try { this.load(); } catch(error) { this.close(); throw error; }
  }
  load() {
    if (!existsSync(this.file)) return [];
    if (lstatSync(this.file).size > 20 * 1024 * 1024) fail('AUDIT_LIMIT', 'Archive the audit journal before enabling the router');
    try { return readFileSync(this.file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)); }
    catch { fail('AUDIT_CORRUPT', 'Audit journal is incomplete; inspect it before resuming routing'); }
  }
  append(record) {
    if(this.closed) fail('AUDIT_CLOSED','Journal owner has been disposed');
    const fd = openSync(this.file, 'a', 0o600);
    try { writeFileSync(fd, JSON.stringify(record) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  }
  close() {
    if(this.closed) return;
    this.closed=true;
    const stat=lstatSync(this.lock);
    if(!stat.isFile() || stat.isSymbolicLink()) fail('AUDIT_LOCKED','Journal ownership changed');
    if(JSON.parse(readFileSync(this.lock,'utf8')).owner!==this.owner) fail('AUDIT_LOCKED','Journal ownership changed');
    unlinkSync(this.lock);
  }
}
