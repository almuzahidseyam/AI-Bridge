import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {safePath,checkText,combine,readZipEntry,MAX_FILE,MAX_BYTES} from '../extension/policy.mjs';
const require=createRequire(import.meta.url),JSZip=require('../extension/jszip.min.js');
test('blocks nested hidden paths, backslashes, traversal, device syntax and sensitive names',()=>{
  for(const name of ['.env','root/.git/config','a/../secret.txt','a\\.env','/root/a.py','C:/a.py','a\0.py','a//b.py','node_modules/index.js','Credentials.json','root/id_rsa.txt','secrets.yaml','file.pem'])assert.equal(safePath(name),false,name);
  for(const name of ['workspace/app.py','folder/README.md','Dockerfile','nested/main.tsx'])assert.equal(safePath(name),true,name);
});
test('text budget counts UTF-8 bytes and rejects binary or recognized credentials',()=>{
  assert.throws(()=>checkText('ক'.repeat(MAX_BYTES/3+1)));
  assert.throws(()=>checkText('a\0b'));assert.throws(()=>checkText('ghp_'+'a'.repeat(36)));assert.throws(()=>checkText('-----BEGIN PRIVATE KEY-----'));assert.equal(checkText('review me'),'review me');
});
test('combined output cannot exceed total budget through formatting overhead',()=>{
  assert.throws(()=>combine([{name:'a.txt',text:'a'.repeat(MAX_FILE)},{name:'b.txt',text:'b'.repeat(MAX_FILE)}]));
  const text=combine([{name:'a.md',text:'```\nQuoted instructions'}]);assert.match(text,/reference|Reference/);assert.match(text,/\\n/);
});
test('file count and individual size are bounded',()=>{
  assert.throws(()=>combine(Array.from({length:201},()=>({name:'a.py',text:'x'}))));assert.throws(()=>combine([{name:'a.py',text:'x'.repeat(MAX_FILE+1)}]));
});
test('real compressed ZIP bombs stop at expanded-byte budget',async()=>{
  const zip=new JSZip();zip.file('big.txt','a'.repeat(2*1024*1024));const packed=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});assert.ok(packed.length<10000);
  const loaded=await JSZip.loadAsync(packed);await assert.rejects(readZipEntry(loaded.file('big.txt'),1000),/exceeds/);
});
test('ZIP text decodes strictly and handles valid content',async()=>{
  const zip=new JSZip();zip.file('ok.txt','বাংলা');zip.file('invalid.txt',new Uint8Array([255,254,0,0]));
  const loaded=await JSZip.loadAsync(await zip.generateAsync({type:'nodebuffer'}));assert.equal(await readZipEntry(loaded.file('ok.txt'),100),'বাংলা');await assert.rejects(readZipEntry(loaded.file('invalid.txt'),100));
});
test('ZIP normalization cannot hide traversal through unsafeOriginalName',async()=>{
  const zip=new JSZip();zip.file('../escape.txt','x');const loaded=await JSZip.loadAsync(await zip.generateAsync({type:'nodebuffer'}));const entry=loaded.file('escape.txt');assert.equal(safePath(entry.name),true);assert.equal(safePath(entry.unsafeOriginalName),false);
});
