document.getElementById('exportBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerText = "Extracting chat context...";
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
        if (chrome.runtime.lastError) {
            status.innerText = "❌ Reload page & try again.";
            status.style.color = "#f85149";
            return;
        }
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
        if (chrome.runtime.lastError) {
            status.innerText = "❌ Reload page & try again.";
            status.style.color = "#f85149";
            return;
        }
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
    
    // BUG FIX: Ignore massive directories to prevent memory crash
    const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'build', 'venv', '__pycache__', '.env'];
    
    try {
        let zip = new JSZip();
        let workspace = zip.folder("workspace");
        for (let i = 0; i < files.length; i++) {
            let path = files[i].webkitRelativePath;
            if (ignoreDirs.some(dir => path.includes('/' + dir + '/'))) continue;
            workspace.file(path, files[i]);
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

// Feature 4: Auto-Unzip & Inject
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
        const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'build', 'venv', '__pycache__'];

        for (let relativePath in zip.files) {
            let zipEntry = zip.files[relativePath];
            if (zipEntry.dir) continue;
            
            // BUG FIX: Skip huge directories
            if (ignoreDirs.some(dir => relativePath.includes(dir + '/'))) continue;

            if (relativePath.includes('chat_history.txt')) {
                historyContent = await zipEntry.async("string");
                continue;
            }

            let ext = relativePath.split('.').pop().toLowerCase();
            if (textExtensions.includes(ext) || !relativePath.includes('.')) {
                // BUG FIX: Skip files larger than 1MB to prevent V8 memory crashes
                if (zipEntry._data && zipEntry._data.uncompressedSize > 1048576) continue;
                
                let fileData = await zipEntry.async("string");
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
                if (chrome.runtime.lastError) {
                    status.innerText = "❌ Reload page & try again.";
                    status.style.color = "#f85149";
                    return;
                }
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
