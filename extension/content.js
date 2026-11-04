(() => {
  if(globalThis.__aiBridgeV8)return;
  globalThis.__aiBridgeV8=true;
  const limit=200000;
  const selectors={
    'chatgpt.com':{messages:'[data-message-author-role]',input:'#prompt-textarea'},
    'claude.ai':{messages:'.font-user-message, .font-claude-message',input:'[contenteditable="true"][role="textbox"]'},
    'gemini.google.com':{messages:'user-query, model-response',input:'.ql-editor[contenteditable="true"]'},
    'www.perplexity.ai':{messages:'.prose',input:'textarea'},
    'huggingface.co':{messages:'[data-message-id]',input:'textarea'}
  };
  function visible(element){return element.getClientRects().length>0;}
  chrome.runtime.onMessage.addListener((request,sender,respond)=>{
    try {
      const config=selectors[location.hostname];if(!config)throw new Error('Unsupported chat page.');
      if(request.action==='extract'){
        const messages=[...document.querySelectorAll(config.messages)].filter(visible).slice(-100);
        if(!messages.length)throw new Error('No recognized chat messages found. The site layout may have changed.');
        const parts=[];let size=0;
        for(const item of messages){const role=item.getAttribute('data-message-author-role') || (item.matches('user-query,.font-user-message')?'user':item.matches('model-response,.font-claude-message')?'assistant':'source message (role unknown)');const text=`[${role}]\n${item.innerText.trim()}`;size+=new TextEncoder().encode(text).length+2;if(size>limit)throw new Error('Loaded chat exceeds 200 KB. Copy a smaller selection into the preview.');parts.push(text);}
        respond({success:true,text:parts.join('\n\n')});return;
      }
      if(request.action==='insert'){
        const text=request.text;if(typeof text!=='string' || !text.trim() || new TextEncoder().encode(text).length>limit)throw new Error('Empty or oversized text.');
        const inputs=[...document.querySelectorAll(config.input)].filter(element=>visible(element) && !element.disabled && !element.readOnly);
        if(inputs.length!==1)throw new Error('A single supported chat editor could not be identified. Copy the reviewed text manually.');
        const input=inputs[0];const old=input instanceof HTMLTextAreaElement?input.value:input.innerText;
        if(old.trim())throw new Error('The chat draft is not empty. Your existing text was left unchanged.');
        input.focus();
        if(input instanceof HTMLTextAreaElement){const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(input,text);input.dispatchEvent(new Event('input',{bubbles:true}));}
        else if(!document.execCommand('insertText',false,text))throw new Error('This editor rejected insertion. Review the draft and paste manually.');
        const actual=input instanceof HTMLTextAreaElement?input.value:input.innerText;
        if(actual.replace(/\r\n/g,'\n').trim()!==text.replace(/\r\n/g,'\n').trim())throw new Error('Insertion could not be verified. Review the draft before sending.');
        respond({success:true});return;
      }
      respond({success:false,error:'Unknown action.'});
    }catch(error){respond({success:false,error:error.message || 'Operation failed.'});}
  });
})();
