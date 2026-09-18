document.getElementById('exportBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerText = "Extracting chat context...";
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
        if (response && response.success) {
            status.innerText = "✅ Context saved!";
            status.style.color = "#3fb950";
        } else {
            status.innerText = "❌ Failed to extract.";
            status.style.color = "#f85149";
        }
    });
});

document.getElementById('injectBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerText = "Injecting context...";
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "inject" }, (response) => {
        if (response && response.success) {
            status.innerText = "🚀 Injection complete!";
            status.style.color = "#3fb950";
        } else {
            status.innerText = "❌ Failed to inject.";
            status.style.color = "#f85149";
        }
    });
});

document.getElementById('settingsBtn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});

// Feature: JSZip Integration
document.getElementById('folderPicker').addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;
    
    const status = document.getElementById('status');
    status.innerText = "📦 Packaging ZIP...";
    status.style.color = "#8957e5";
    
    try {
        let zip = new JSZip();
        let workspace = zip.folder("workspace");
        
        // Add all user selected files to the workspace folder
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            workspace.file(file.webkitRelativePath, file);
        }
        
        // Fetch chat context from storage to bundle with the ZIP
        chrome.storage.local.get(['aiBridgeContext', 'customPrompt'], async (result) => {
            let context = result.aiBridgeContext || "No chat history extracted.";
            let prompt = result.customPrompt || 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\nYou are receiving a transferred context from another AI. Read the history below and seamlessly resume the project.\nReply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT};
            
            let megaPrompt = prompt.replace('{CONTEXT}', context);
            zip.file("00_READ_ME_FIRST.md", megaPrompt);
            zip.file("context/chat_history.txt", context);
            
            // Generate ZIP blob
            let content = await zip.generateAsync({type: "blob"});
            
            // Create a temporary link to download
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "AI-Bridge-Workspace.zip";
            link.click();
            
            status.innerText = "✅ ZIP Downloaded!";
            status.style.color = "#3fb950";
        });
    } catch (e) {
        status.innerText = "❌ Zip Error: " + e.message;
        status.style.color = "#f85149";
    }
});
