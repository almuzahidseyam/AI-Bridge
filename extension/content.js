// AI-Bridge Advanced Content Script (v7.0 Security & Stability)

function showToast(message, isSuccess = true) {
    let toast = document.createElement('div');
    toast.innerText = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.padding = '12px 24px';
    toast.style.background = isSuccess ? '#238636' : '#f85149';
    toast.style.color = 'white';
    toast.style.borderRadius = '8px';
    toast.style.fontWeight = 'bold';
    toast.style.zIndex = '999999';
    toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toast.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// v7.0: Native DOM Typing Simulation
function nativeTypingSimulation(payloadText) {
    let inputBox = document.querySelector('textarea, [contenteditable="true"], #prompt-textarea, rich-textarea, .ql-editor');
    if (!inputBox) return false;

    // Focus the input box first
    inputBox.focus();
    
    // Use execCommand to simulate native pasting. This natively fires beforeinput, input, and change events!
    let success = document.execCommand('insertText', false, payloadText);
    
    // If native execCommand fails (deprecated in some strict contexts), fallback to React hack
    if (!success) {
        console.warn("AI-Bridge: execCommand failed, falling back to React hack...");
        let script = document.createElement('script');
        script.textContent = 
            (function() {
                let box = document.querySelector('textarea, [contenteditable="true"], #prompt-textarea, rich-textarea, .ql-editor');
                if (box) {
                    if (box.tagName === 'TEXTAREA') { box.value =  + JSON.stringify(payloadText) + ; } 
                    else { box.innerText =  + JSON.stringify(payloadText) + ; }
                    box.dispatchEvent(new Event('input', { bubbles: true }));
                    box.dispatchEvent(new Event('change', { bubbles: true }));
                    let reactProps = Object.keys(box).find(k => k.startsWith('__reactProps$'));
                    if (reactProps && box[reactProps].onChange) {
                        box[reactProps].onChange({target: box});
                    }
                }
            })();
        ;
        document.documentElement.appendChild(script);
        script.remove();
    }
    return true;
}

function handleInjection(megaPrompt, sendResponse) {
    if (megaPrompt.length > 200000) {
        showToast("⚠️ Warning: Payload is massive. Browser might lag slightly.", false);
    }
    
    navigator.clipboard.writeText(megaPrompt).then(() => {
        nativeTypingSimulation(megaPrompt);
        showToast("🌉 AI-Bridge: Context Injected! Press Send.");
        sendResponse({ success: true });
    }).catch(err => {
        nativeTypingSimulation(megaPrompt);
        showToast("🌉 AI-Bridge: Context Injected! (Clipboard blocked)");
        sendResponse({ success: true });
    });
}

function extractChatHeuristically(limit) {
    let parsedMessages = [];
    const url = window.location.hostname;
    
    let elements = [];
    if (url.includes('chatgpt.com')) elements = Array.from(document.querySelectorAll('[data-message-author-role]'));
    else if (url.includes('claude.ai')) elements = Array.from(document.querySelectorAll('.font-user-message, .font-claude-message'));
    else if (url.includes('gemini.google.com')) elements = Array.from(document.querySelectorAll('user-query, model-response'));
    else elements = Array.from(document.querySelectorAll('.prose'));

    if (elements.length === 0) {
        let paragraphs = Array.from(document.querySelectorAll('p, .message, [role="row"]'));
        elements = paragraphs.filter(p => p.innerText.length > 10);
    }

    if (limit > 0 && elements.length > limit) elements = elements.slice(-limit);
    
    elements.forEach((msg, idx) => {
        let role = (idx % 2 === 0) ? 'USER' : 'ASSISTANT';
        if (msg.hasAttribute('data-message-author-role')) {
            role = msg.getAttribute('data-message-author-role').toUpperCase();
        } else if (msg.className && msg.className.includes('user')) {
            role = 'USER';
        } else if (msg.tagName && msg.tagName.toLowerCase() === 'user-query') {
            role = 'USER';
        }

        let text = '';
        msg.childNodes.forEach(node => {
            if (node.nodeName === 'PRE') text += '\n`\n' + node.innerText + '\n`\n';
            else text += node.innerText + '\n';
        });
        
        parsedMessages.push(\n\n---  + role +  ---\n + (text.trim() || msg.innerText.trim()));
    });
    return parsedMessages;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract') {
        chrome.storage.local.get(['contextLimit'], (result) => {
            let limit = result.contextLimit !== undefined ? result.contextLimit : 10;
            try {
                let parsedMessages = extractChatHeuristically(limit);
                if (parsedMessages.length === 0) {
                    showToast("AI-Bridge: No chat found to extract!", false);
                    return sendResponse({ success: false });
                }
                
                let chatContext = "";
                if (limit > 0) chatContext = [⚡ SYSTEM NOTE: Chat context minified to the last  + limit +  messages]\n;
                chatContext += parsedMessages.join('');

                chrome.storage.local.set({ aiBridgeContext: chatContext }, () => {
                    if(chrome.runtime.lastError) {
                        showToast("AI-Bridge Storage Error: " + chrome.runtime.lastError.message, false);
                        return sendResponse({ success: false });
                    }
                    showToast("🌉 AI-Bridge: Context Extracted (" + parsedMessages.length + " Msgs)!");
                    sendResponse({ success: true });
                });
            } catch (e) {
                showToast("AI-Bridge Error: " + e.message, false);
                sendResponse({ success: false });
            }
        });
        return true;
    } 
    else if (request.action === 'inject' || request.action === 'inject_payload') {
        chrome.storage.local.get(['aiBridgeContext', 'customPrompt'], (result) => {
            let context = result.aiBridgeContext || "No history.";
            let defaultPrompt = 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\nYou are receiving a transferred context from another AI. Read the history below and seamlessly resume the project.\nReply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT};
            
            let megaPromptTemplate = result.customPrompt || defaultPrompt;
            let megaPrompt = request.payload || megaPromptTemplate.replace('{CONTEXT}', context);

            handleInjection(megaPrompt, sendResponse);
        });
        return true;
    }
});
