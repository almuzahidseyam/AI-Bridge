// AI-Bridge Advanced Content Script (v5.1 Bug Fixes)
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

// BUG FIX: Inject a script to the main world to trigger React events properly
function triggerReactEvent(payloadText) {
    let script = document.createElement('script');
    script.textContent = 
        (function() {
            let inputBox = document.querySelector('textarea, [contenteditable="true"], #prompt-textarea, rich-textarea, .ql-editor');
            if (inputBox) {
                if (inputBox.tagName === 'TEXTAREA') { inputBox.value =  + JSON.stringify(payloadText) + ; } 
                else { inputBox.innerText =  + JSON.stringify(payloadText) + ; }
                
                inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                inputBox.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Hack for React
                let reactProps = Object.keys(inputBox).find(k => k.startsWith('__reactProps$'));
                if (reactProps && inputBox[reactProps].onChange) {
                    inputBox[reactProps].onChange({target: inputBox});
                }
            }
        })();
    ;
    document.documentElement.appendChild(script);
    script.remove();
}

function handleInjection(megaPrompt, sendResponse) {
    // Write to clipboard as a fallback
    navigator.clipboard.writeText(megaPrompt).then(() => {
        triggerReactEvent(megaPrompt);
        showToast("🌉 AI-Bridge: Context Injected! Press Send.");
        sendResponse({ success: true });
    }).catch(err => {
        console.warn("AI-Bridge Clipboard warning (needs page focus):", err);
        // Even if clipboard fails, try to inject
        triggerReactEvent(megaPrompt);
        showToast("🌉 AI-Bridge: Context Injected! (Clipboard blocked)");
        sendResponse({ success: true });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract') {
        chrome.storage.local.get(['contextLimit'], (result) => {
            let limit = result.contextLimit !== undefined ? result.contextLimit : 10;
            let chatContext = '';
            const url = window.location.hostname;
            
            try {
                let parsedMessages = [];
                if (url.includes('chatgpt.com')) {
                    let elements = Array.from(document.querySelectorAll('[data-message-author-role]'));
                    if (limit > 0 && elements.length > limit) elements = elements.slice(-limit);
                    elements.forEach(msg => {
                        let role = msg.getAttribute('data-message-author-role');
                        let text = '';
                        msg.childNodes.forEach(node => {
                            if (node.nodeName === 'PRE') text += '\n`\n' + node.innerText + '\n`\n';
                            else text += node.innerText + '\n';
                        });
                        parsedMessages.push(\n\n---  + role.toUpperCase() +  ---\n + text.trim());
                    });
                } else if (url.includes('claude.ai')) {
                    let elements = Array.from(document.querySelectorAll('.font-user-message, .font-claude-message'));
                    if (limit > 0 && elements.length > limit) elements = elements.slice(-limit);
                    elements.forEach(msg => {
                        let role = msg.className.includes('user') ? 'USER' : 'ASSISTANT';
                        parsedMessages.push(\n\n---  + role +  ---\n + msg.innerText.trim());
                    });
                } else if (url.includes('gemini.google.com')) {
                    let elements = Array.from(document.querySelectorAll('user-query, model-response'));
                    if (limit > 0 && elements.length > limit) elements = elements.slice(-limit);
                    elements.forEach(msg => {
                        let role = msg.tagName.toLowerCase() === 'user-query' ? 'USER' : 'ASSISTANT';
                        parsedMessages.push(\n\n---  + role +  ---\n + msg.innerText.trim());
                    });
                } else if (url.includes('perplexity.ai') || url.includes('huggingface.co')) {
                    let elements = Array.from(document.querySelectorAll('.prose'));
                    if (limit > 0 && elements.length > limit) elements = elements.slice(-limit);
                    elements.forEach((msg, idx) => {
                        let role = (idx % 2 === 0) ? 'USER' : 'ASSISTANT';
                        parsedMessages.push(\n\n---  + role +  ---\n + msg.innerText.trim());
                    });
                } else {
                    parsedMessages.push(document.body.innerText.substring(0, 8000));
                }

                if (parsedMessages.length === 0) {
                    showToast("AI-Bridge: No chat found to extract!", false);
                    return sendResponse({ success: false });
                }
                
                if (limit > 0) chatContext = [⚡ SYSTEM NOTE: Chat context minified to the last  + limit +  messages]\n;
                chatContext += parsedMessages.join('');

                chrome.storage.local.set({ aiBridgeContext: chatContext }, () => {
                    if(chrome.runtime.lastError) {
                        showToast("AI-Bridge Storage Error: Quota exceeded", false);
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
