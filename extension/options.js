const presets = {
    default: 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\nYou are receiving a transferred context from another AI. Read the history and workspace below to seamlessly resume the project.\nReply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT}\n\n--- WORKSPACE ---\n{WORKSPACE},
    webdev: 🌐 [WEB DEV MODE: AI-BRIDGE]\nYou are an elite Full-Stack Web Developer. We are transferring a web project to you. Read the history and codebase below.\nReply ONLY with: "**[Web Dev Ready]** 🟢 Give me the next feature!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT}\n\n--- WORKSPACE ---\n{WORKSPACE},
    data: 📊 [DATA SCIENCE MODE: AI-BRIDGE]\nYou are an elite Data Scientist. We are transferring a Python/Data project to you. Analyze the previous logic and code.\nReply ONLY with: "**[Data Science Sync Complete]** 🟢 Awaiting dataset or next task!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT}\n\n--- WORKSPACE ---\n{WORKSPACE},
    writer: ✍️ [WRITER MODE: AI-BRIDGE]\nYou are an expert author and editor. We are transferring a writing project to you. Maintain the exact tone, style, and persona used in the history below.\nReply ONLY with: "**[Writer Sync Complete]** 🟢 Let's write the next chapter!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT}\n\n--- DRAFTS ---\n{WORKSPACE}
};

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['customPrompt', 'contextLimit'], (result) => {
        document.getElementById('promptBox').value = result.customPrompt || presets.default;
        if (result.contextLimit !== undefined) {
            document.getElementById('contextLimit').value = result.contextLimit;
        }
    });
});

document.getElementById('presetPicker').addEventListener('change', (e) => {
    let mode = e.target.value;
    if (mode !== 'custom' && presets[mode]) {
        document.getElementById('promptBox').value = presets[mode];
    }
});

document.getElementById('saveBtn').addEventListener('click', () => {
    let newPrompt = document.getElementById('promptBox').value;
    let limit = parseInt(document.getElementById('contextLimit').value) || 0;
    
    chrome.storage.local.set({ customPrompt: newPrompt, contextLimit: limit }, () => {
        let status = document.getElementById('status');
        status.innerText = '✅ Settings saved successfully!';
        document.getElementById('presetPicker').value = 'custom';
        setTimeout(() => status.innerText = '', 2000);
    });
});
