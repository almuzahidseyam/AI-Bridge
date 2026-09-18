// AI-Bridge Advanced Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract') {
        let chatContext = '';
        const url = window.location.hostname;

        if (url.includes('chatgpt.com')) {
            let messages = document.querySelectorAll('[data-message-author-role]');
            messages.forEach(msg => {
                let role = msg.getAttribute('data-message-author-role');
                // Extract code blocks properly
                let text = '';
                msg.childNodes.forEach(node => {
                    if (node.nodeName === 'PRE') {
                        text += '\n`\n' + node.innerText + '\n`\n';
                    } else {
                        text += node.innerText + '\n';
                    }
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

        chrome.runtime.sendMessage({ action: 'saveContext', data: chatContext }, () => {
            sendResponse({ success: true });
        });
        return true;
    } 
    
    else if (request.action === 'inject') {
        chrome.runtime.sendMessage({ action: 'getContext' }, (response) => {
            if (!response.data) return sendResponse({ success: false });

            let megaPrompt = 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\n +
                You are receiving a transferred context from another AI. Read the history below and seamlessly resume the project.\n +
                Reply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n +
                --- PREVIOUS CHAT HISTORY ---\n + response.data;

            let inputBox = document.querySelector('textarea, [contenteditable="true"], #prompt-textarea');
            if (inputBox) {
                if (inputBox.tagName === 'TEXTAREA') {
                    inputBox.value = megaPrompt;
                } else {
                    inputBox.innerText = megaPrompt;
                }
                inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                
                // For React specific handling (like ChatGPT)
                let reactProps = Object.keys(inputBox).find(k => k.startsWith('__reactProps$'));
                if (reactProps && inputBox[reactProps].onChange) {
                    inputBox[reactProps].onChange({target: inputBox});
                }
                
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false });
            }
        });
        return true;
    }
});
