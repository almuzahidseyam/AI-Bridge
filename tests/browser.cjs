const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const JSZip=require('jszip');
const root=path.resolve(__dirname,'../extension');
assert.equal(fs.readFileSync(path.join(root,'jszip.min.js'),'utf8').replace(/\r\n/g,'\n'),fs.readFileSync(require.resolve('jszip/dist/jszip.min.js'),'utf8').replace(/\r\n/g,'\n'),'Vendored JSZip must match the locked package');
const server=http.createServer((req,res)=>{
 const filename=path.basename(new URL(req.url,'http://localhost').pathname);const file=path.join(root,filename);
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const ext=path.extname(file);res.setHeader('Content-Type',ext==='.html'?'text/html':ext==='.css'?'text/css':'text/javascript');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_CHANNEL?{channel:process.env.CHROME_CHANNEL}:{})});
 try {
  const chat=await browser.newPage();await chat.route('https://chatgpt.com/fixture',route=>route.fulfill({contentType:'text/html',body:'<main><div data-message-author-role="user">A direct text node</div><div data-message-author-role="assistant"><pre>print(1)</pre></div><textarea id="prompt-textarea"></textarea></main>'}));await chat.goto('https://chatgpt.com/fixture');
  await chat.evaluate(()=>{window.listeners=[];window.chrome={runtime:{onMessage:{addListener:fn=>window.listeners.push(fn)}}};});
  await chat.addScriptTag({path:path.join(root,'content.js')});await chat.addScriptTag({path:path.join(root,'content.js')});assert.equal(await chat.evaluate(()=>window.listeners.length),1);
  const send=message=>chat.evaluate(message=>new Promise(resolve=>window.listeners[0](message,{},resolve)),message);
  const extracted=await send({action:'extract'});assert.equal(extracted.success,true);assert.match(extracted.text,/A direct text node/);assert.doesNotMatch(extracted.text,/undefined/);
  assert.equal((await send({action:'insert',text:'Reviewed context'})).success,true);assert.equal(await chat.locator('textarea').inputValue(),'Reviewed context');
  assert.equal((await send({action:'insert',text:'overwrite'})).success,false);assert.equal(await chat.locator('textarea').inputValue(),'Reviewed context');
  await chat.locator('textarea').evaluate(el=>el.remove());assert.equal((await send({action:'insert',text:'x'})).success,false);
  await chat.evaluate(()=>{const el=document.createElement('div');el.id='prompt-textarea';el.contentEditable='true';el.style.minHeight='50px';document.body.append(el);});assert.equal((await send({action:'insert',text:'Line one\nLine two'})).success,true);
  const popup=await browser.newPage({viewport:{width:440,height:1100}});const errors=[];popup.on('pageerror',e=>errors.push(e.message));
  await popup.addInitScript(()=>{window.fakeUrl='https://chatgpt.com/fixture';window.sent=[];window.chrome={tabs:{query:async()=>[{id:1,url:window.fakeUrl}],sendMessage:async(id,message)=>{window.sent.push(message);return message.action==='extract'?{success:true,text:'[user]\nFixture conversation'}:{success:true};}},scripting:{executeScript:async()=>{}}};});
  await popup.goto(`http://127.0.0.1:${server.address().port}/popup.html`);await popup.getByRole('button',{name:'Read visible chat'}).click();await popup.locator('#status').filter({hasText:'Loaded visible messages'}).waitFor();assert.match(await popup.locator('#preview').inputValue(),/Fixture conversation/);
  await popup.locator('#preview').fill('Edited reviewed context');const download=popup.waitForEvent('download');await popup.getByRole('button',{name:'Download reviewed ZIP'}).click();const saved=await download;const archive=await JSZip.loadAsync(fs.readFileSync(await saved.path()));assert.equal(await archive.file('context/chat_history.txt').async('string'),'Edited reviewed context');
  await popup.locator('#zip').setInputFiles({name:'reviewed.zip',mimeType:'application/zip',buffer:fs.readFileSync(await saved.path())});await popup.locator('#status').filter({hasText:'Loaded the reviewed snapshot'}).waitFor();assert.equal(await popup.locator('#preview').inputValue(),'Edited reviewed context');
  await popup.getByRole('button',{name:'Insert into empty draft'}).click();await popup.locator('#status').filter({hasText:'nothing was sent'}).waitFor();assert.equal(await popup.evaluate(()=>window.sent.at(-1).text),'Edited reviewed context');
  await popup.evaluate(()=>window.fakeUrl='https://evil.example/chatgpt.com');await popup.getByRole('button',{name:'Read visible chat'}).click();await popup.locator('#status').filter({hasText:'supported AI chat'}).waitFor();assert.equal(await popup.locator('#preview').inputValue(),'Edited reviewed context');
  const zip=new JSZip();zip.file('workspace/app.py','print(1)');zip.file('workspace/.env','never-export-this');zip.file('../escape.txt','unsafe-path');await popup.locator('#zip').setInputFiles({name:'fixture.zip',mimeType:'application/zip',buffer:await zip.generateAsync({type:'nodebuffer'})});await popup.locator('#status').filter({hasText:'Loaded 1 files'}).waitFor();assert.doesNotMatch(await popup.locator('#preview').inputValue(),/never-export-this|unsafe-path/);
  const bomb=new JSZip();bomb.file('big.txt','a'.repeat(2*1024*1024));await popup.locator('#zip').setInputFiles({name:'large.zip',mimeType:'application/zip',buffer:await bomb.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});await popup.locator('#status').filter({hasText:'exceeds the limit'}).waitFor();
  if(process.env.SCREENSHOT_PATH)await popup.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
  assert.deepEqual(errors,[]);assert.equal(await popup.evaluate(()=>localStorage.length),0);
  console.log('Browser fixture extraction, verified textarea/contenteditable insertion, existing-draft preservation, popup preview/download, host restrictions, ZIP filtering and expansion budget passed.');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
