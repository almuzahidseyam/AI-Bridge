let defaultPrompt = 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\nYou are receiving a transferred context from another AI. Read the history and workspace codebase below to seamlessly resume the project.\nReply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT}\n\n--- CURRENT WORKSPACE CODEBASE ---\n{WORKSPACE};

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['customPrompt', 'contextLimit'], (result) => {
        document.getElementById('promptBox').value = result.customPrompt || defaultPrompt;
        if (result.contextLimit !== undefined) {
            document.getElementById('contextLimit').value = result.contextLimit;
        }
    });
});

document.getElementById('saveBtn').addEventListener('click', () => {
    let newPrompt = document.getElementById('promptBox').value;
    let limit = parseInt(document.getElementById('contextLimit').value) || 0;
    
    chrome.storage.local.set({ customPrompt: newPrompt, contextLimit: limit }, () => {
        let status = document.getElementById('status');
        status.innerText = '✅ Settings saved successfully!';
        setTimeout(() => status.innerText = '', 2000);
    });
});
