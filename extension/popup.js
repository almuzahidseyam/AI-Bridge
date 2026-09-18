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

// Feature 3: Package ZIP
document.getElementById('folderPicker').addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;
    const status = document.getElementById('status');
    status.innerText = "📦 Packaging ZIP...";
    status.style.color = "#8957e5";
    
    try {
        let zip = new JSZip();
        let workspace = zip.folder("workspace");
        for (let i = 0; i < files.length; i++) {
            workspace.file(files[i].webkitRelativePath, files[i]);
        }
        chrome.storage.local.get(['aiBridgeContext', 'customPrompt'], async (result) => {
            let context = result.aiBridgeContext || "No chat history extracted.";
            zip.file("context/chat_history.txt", context);
            let content = await zip.generateAsync({type: "blob"});
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

// Feature 4 (v3.0): Auto-Unzip & Inject
document.getElementById('zipPicker').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById('status');
    status.innerText = "🪄 Unzipping and parsing...";
    status.style.color = "#bf3989";

    try {
        let zip = await JSZip.loadAsync(file);
        let workspaceXml = "<workspace>\n";
        let historyContent = "";
        
        const textExtensions = ['js','html','css','py','md','txt','json','ts','jsx','tsx','c','cpp','java','php','rs','go'];

        for (let relativePath in zip.files) {
            let zipEntry = zip.files[relativePath];
            if (zipEntry.dir) continue;

            if (relativePath.includes('chat_history.txt')) {
                historyContent = await zipEntry.async("string");
                continue;
            }

            // Simple binary filter based on extension
            let ext = relativePath.split('.').pop().toLowerCase();
            if (textExtensions.includes(ext) || !relativePath.includes('.')) {
                let fileData = await zipEntry.async("string");
                // Remove root folder name if needed, but keeping it is fine
                workspaceXml += <file path=" + relativePath + ">\n + fileData + \n</file>\n\n;
            }
        }
        workspaceXml += "</workspace>";

        chrome.storage.local.get(['customPrompt'], async (result) => {
            let defaultPrompt = 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\nYou are receiving a transferred context from another AI. Read the history and workspace codebase below to seamlessly resume the project.\nReply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT}\n\n--- CURRENT WORKSPACE CODEBASE ---\n{WORKSPACE};
            
            let template = result.customPrompt || defaultPrompt;
            if (!template.includes('{WORKSPACE}')) {
                template += "\n\n--- CURRENT WORKSPACE CODEBASE ---\n{WORKSPACE}";
            }
            
            let finalPayload = template.replace('{CONTEXT}', historyContent || 'No history.').replace('{WORKSPACE}', workspaceXml);

            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { action: "inject_payload", payload: finalPayload }, (response) => {
                if (response && response.success) {
                    status.innerText = "🪄 Magic Injection Complete!";
                    status.style.color = "#3fb950";
                } else {
                    status.innerText = "❌ Injection failed.";
                    status.style.color = "#f85149";
                }
            });
        });
    } catch (e) {
        status.innerText = "❌ Parse Error: " + e.message;
        status.style.color = "#f85149";
    }
});
