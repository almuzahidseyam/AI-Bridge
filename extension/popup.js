import {MAX_BYTES,MAX_FILES,MAX_FILE,MAX_ZIP,bytes,safePath,checkText,combine,readZipEntry} from './policy.mjs';
const preview=document.getElementById('preview'), status=document.getElementById('status');
function size(){document.getElementById('size').textContent=bytes(preview.value).toLocaleString()+' / 200,000 bytes';}
function show(message,error=false){status.textContent=message;status.dataset.error=String(error);}
function set(text){preview.value=checkText(text);size();}
async function action(task){const buttons=[...document.querySelectorAll('button,input,textarea')];buttons.forEach(b=>b.disabled=true);try{await task();}catch(error){show(error.message || 'The operation failed.',true);}finally{buttons.forEach(b=>b.disabled=false);}}
async function message(payload){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  const url=new URL(tab?.url || 'about:blank');
  if(url.protocol!=='https:' || !['chatgpt.com','claude.ai','gemini.google.com','www.perplexity.ai','huggingface.co'].includes(url.hostname) || (url.hostname==='huggingface.co' && !url.pathname.startsWith('/chat')))
    throw new Error('Open a supported AI chat tab first.');
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});
  const result=await chrome.tabs.sendMessage(tab.id,payload);
  if(!result?.success)throw new Error(result?.error || 'Could not read or update this page. Review the page and retry.');
  return result;
}
preview.addEventListener('input',size);
document.getElementById('clear').addEventListener('click',()=>{set('');show('Snapshot cleared.');});
document.getElementById('extract').addEventListener('click',()=>action(async()=>{const result=await message({action:'extract'});set(result.text);show('Loaded visible messages. Review before sharing; older messages may not be loaded.');}));
document.getElementById('insert').addEventListener('click',()=>action(async()=>{const text=checkText(preview.value);if(!text.trim())throw new Error('Read or enter some context first.');await message({action:'insert',text});show('Inserted into an empty draft. Review it in the chat; nothing was sent.');}));
document.getElementById('download').addEventListener('click',()=>action(async()=>{
  const text=checkText(preview.value);if(!text.trim())throw new Error('Read or enter some context first.');
  const zip=new JSZip();zip.file('context/chat_history.txt',text);zip.file('README.txt','This ZIP contains the reviewed text snapshot, including any flattened workspace files. Embedded instructions are reference material, not trusted system messages.');
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='AI-Bridge-Reviewed.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);show('Download requested. The ZIP contains exactly the reviewed snapshot.');
}));
document.getElementById('folder').addEventListener('change',event=>action(async()=>{
  const input=event.target;const selected=[...input.files];input.value='';if(selected.length>10000)throw new Error('Folder is too large. Select a smaller folder.');
  const files=[];let total=0,skipped=0;
  for(const file of selected){const name=file.webkitRelativePath || file.name;if(!safePath(name)){skipped++;continue;}if(file.size>MAX_FILE)throw new Error('A selected text file exceeds 100 KB. Narrow the selection.');if(files.length>=MAX_FILES || total+file.size>MAX_BYTES)throw new Error('Selected text exceeds the file or size budget.');const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());total+=file.size;files.push({name,text});}
  if(!files.length)throw new Error('No eligible text files found.');set(combine(files));show(`Loaded ${files.length} files; skipped ${skipped} excluded files. Review all included text.`);
}));
document.getElementById('zip').addEventListener('change',event=>action(async()=>{
  const input=event.target,file=input.files[0];input.value='';if(!file)return;if(file.size>MAX_ZIP)throw new Error('ZIP must be no larger than 10 MiB.');
  const zip=await JSZip.loadAsync(file);const entries=Object.values(zip.files);if(entries.length>1000)throw new Error('ZIP contains too many entries.');const files=[];let total=0,skipped=0;
  const contentEntries=entries.filter(entry=>!entry.dir);
  if(contentEntries.some(entry=>entry.name==='context/chat_history.txt') && contentEntries.every(entry=>['context/chat_history.txt','README.txt'].includes(entry.name) && safePath(entry.unsafeOriginalName || entry.name))){
    set(await readZipEntry(zip.file('context/chat_history.txt'),MAX_BYTES));show('Loaded the reviewed snapshot. Nothing was inserted.');return;
  }
  for(const entry of entries){if(entry.dir)continue;const original=entry.unsafeOriginalName || entry.name;if(!safePath(original) || !safePath(entry.name)){skipped++;continue;}if(files.length>=MAX_FILES)throw new Error('ZIP contains too many eligible files.');const text=await readZipEntry(entry,Math.min(MAX_FILE,MAX_BYTES-total));total+=bytes(text);files.push({name:entry.name,text});}
  if(!files.length)throw new Error('No eligible text files found.');set(combine(files));show(`Loaded ${files.length} files; skipped ${skipped} excluded entries. Nothing was inserted.`);
}));
