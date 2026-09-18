// AI-Bridge Advanced Content Script (v2.0)
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract') {
        let chatContext = '';
        const url = window.location.hostname;
        try {
            if (url.includes('chatgpt.com')) {
                let messages = document.querySelectorAll('[data-message-author-role]');
                messages.forEach(msg => {
                    let role = msg.getAttribute('data-message-author-role');
                    let text = '';
                    msg.childNodes.forEach(node => {
                        if (node.nodeName === 'PRE') { text += '\n`\n' + node.innerText + '\n`\n'; } 
                        else { text += node.innerText + '\n'; }
                    });
                    chatContext += \n\n---  + role.toUpperCase() +  ---\n + text.trim();
                });
            } else if (url.includes('claude.ai')) {
                let messages = document.querySelectorAll('.font-user-message, .font-claude-message');
                messages.forEach(msg => {
                    let role = msg.className.includes('user') ? 'USER' : 'ASSISTANT';
                    chatContext += \n\n---  + role +  ---\n + msg.innerText.trim();
                });
            } else {
                chatContext = document.body.innerText.substring(0, 8000);
            }

            if (!chatContext || chatContext.trim() === '') {
                showToast("AI-Bridge: No chat found to extract!", false);
                return sendResponse({ success: false });
            }

            chrome.runtime.sendMessage({ action: 'saveContext', data: chatContext }, () => {
                showToast("🌉 AI-Bridge: Context Extracted Successfully!");
                sendResponse({ success: true });
            });
        } catch (e) {
            showToast("AI-Bridge Error: " + e.message, false);
            sendResponse({ success: false });
        }
        return true;
    } 
    else if (request.action === 'inject') {
        chrome.storage.local.get(['aiBridgeContext', 'customPrompt'], (result) => {
            if (!result.aiBridgeContext) {
                showToast("AI-Bridge: No context found in memory!", false);
                return sendResponse({ success: false });
            }

            let defaultPrompt = 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\nYou are receiving a transferred context from another AI. Read the history below and seamlessly resume the project.\nReply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT};
            
            let megaPromptTemplate = result.customPrompt || defaultPrompt;
            let megaPrompt = megaPromptTemplate.replace('{CONTEXT}', result.aiBridgeContext);

            navigator.clipboard.writeText(megaPrompt).then(() => {
                let inputBox = document.querySelector('textarea, [contenteditable="true"], #prompt-textarea');
                if (inputBox) {
                    if (inputBox.tagName === 'TEXTAREA') { inputBox.value = megaPrompt; } 
                    else { inputBox.innerText = megaPrompt; }
                    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    let reactProps = Object.keys(inputBox).find(k => k.startsWith('__reactProps$'));
                    if (reactProps && inputBox[reactProps].onChange) {
                        inputBox[reactProps].onChange({target: inputBox});
                    }
                    showToast("🌉 AI-Bridge: Context Injected! Press Send.");
                    sendResponse({ success: true });
                } else {
                    showToast("🌉 AI-Bridge: Copied to Clipboard! (Hit Ctrl+V)", true);
                    sendResponse({ success: true });
                }
            });
        });
        return true;
    }
});
// Append to content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'inject_payload') {
        let megaPrompt = request.payload;
        navigator.clipboard.writeText(megaPrompt).then(() => {
            let inputBox = document.querySelector('textarea, [contenteditable="true"], #prompt-textarea');
            if (inputBox) {
                if (inputBox.tagName === 'TEXTAREA') { inputBox.value = megaPrompt; } 
                else { inputBox.innerText = megaPrompt; }
                inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                
                let reactProps = Object.keys(inputBox).find(k => k.startsWith('__reactProps$'));
                if (reactProps && inputBox[reactProps].onChange) {
                    inputBox[reactProps].onChange({target: inputBox});
                }
                showToast("🪄 AI-Bridge: Codebase & Context Auto-Injected!");
                sendResponse({ success: true });
            } else {
                showToast("🪄 AI-Bridge: Copied entire codebase to Clipboard! (Ctrl+V)", true);
                sendResponse({ success: true });
            }
        });
        return true;
    }
});
