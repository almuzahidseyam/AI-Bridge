// AI-Bridge v7.0 (Security & Stability)

function handleLivenessError(statusElement) {
    if (chrome.runtime.lastError) {
        statusElement.innerText = "❌ Please REFRESH the page first!";
        statusElement.style.color = "#f85149";
        return true;
    }
    return false;
}

document.getElementById('exportBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerText = "Extracting chat context...";
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
        if (handleLivenessError(status)) return;
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
        if (handleLivenessError(status)) return;
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

// v7.0 Security Firewall Checker
function isPathSafe(path) {
    const parts = path.split('/');
    // Block any folder or file that starts with a dot (e.g. .env, .git, .DS_Store)
    if (parts.some(part => part.startsWith('.'))) return false;
    
    // Block common heavy/binary dirs
    const ignoreDirs = ['node_modules', 'dist', 'build', 'venv', '__pycache__'];
    if (ignoreDirs.some(dir => parts.includes(dir))) return false;
    
    return true;
}

document.getElementById('folderPicker').addEventListener('change', async (event) => {
    const files = event.target.files;
    if (files.length === 0) return;
    const status = document.getElementById('status');
    status.innerText = "📦 Packaging ZIP... 0%";
    status.style.color = "#8957e5";
    
    try {
        let zip = new JSZip();
        let workspace = zip.folder("workspace");
        for (let i = 0; i < files.length; i++) {
            let path = files[i].webkitRelativePath;
            if (!isPathSafe(path)) continue; // SECURITY FIREWALL
            workspace.file(path, files[i]);
        }
        
        chrome.storage.local.get(['aiBridgeContext'], async (result) => {
            let context = result.aiBridgeContext || "No chat history extracted.";
            zip.file("context/chat_history.txt", context);
            
            let content = await zip.generateAsync({type: "blob"}, function updateCallback(metadata) {
                status.innerText = "📦 Packaging ZIP... " + metadata.percent.toFixed(0) + "%";
            });
            
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = "AI-Bridge-Workspace.zip";
            link.click();
            status.innerText = "✅ ZIP Downloaded safely!";
            status.style.color = "#3fb950";
        });
    } catch (e) {
        status.innerText = "❌ Zip Error: " + e.message;
        status.style.color = "#f85149";
    }
});

document.getElementById('zipPicker').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById('status');
    status.innerText = "🪄 Unzipping... 0%";
    status.style.color = "#bf3989";

    try {
        let zip = await JSZip.loadAsync(file);
        let workspaceMarkdown = "\n";
        let historyContent = "";
        
        const textExtensions = ['js','html','css','py','md','txt','json','ts','jsx','tsx','c','cpp','java','php','rs','go', 'sql'];

        let fileCount = Object.keys(zip.files).length;
        let processed = 0;

        for (let relativePath in zip.files) {
            let zipEntry = zip.files[relativePath];
            processed++;
            if (processed % 10 === 0) {
                status.innerText = "🪄 Parsing files... " + Math.round((processed / fileCount) * 100) + "%";
            }

            if (zipEntry.dir) continue;
            
            // SECURITY FIREWALL
            if (!isPathSafe(relativePath)) {
                console.warn("AI-Bridge Blocked unsafe file: " + relativePath);
                continue; 
            }

            if (relativePath.includes('chat_history.txt')) {
                historyContent = await zipEntry.async("string");
                continue;
            }

            let ext = relativePath.split('.').pop().toLowerCase();
            if (textExtensions.includes(ext) || !relativePath.includes('.')) {
                if (zipEntry._data && zipEntry._data.uncompressedSize > 1048576) continue;
                let fileData = await zipEntry.async("string");
                workspaceMarkdown += \n### FILE:  + relativePath + \n\\\${ext}\n + fileData + \n\\\\n;
            }
        }

        chrome.storage.local.get(['customPrompt'], async (result) => {
            let defaultPrompt = 🔄 [SYSTEM AUTO-SYNC: AI-BRIDGE]\nYou are receiving a transferred context from another AI. Read the history and workspace codebase below to seamlessly resume the project.\nReply ONLY with: "**[AI-Bridge Sync Complete]** 🟢 Ready for the next command!"\n\n--- PREVIOUS CHAT HISTORY ---\n{CONTEXT}\n\n--- CURRENT WORKSPACE CODEBASE ---\n{WORKSPACE};
            
            let template = result.customPrompt || defaultPrompt;
            if (!template.includes('{WORKSPACE}')) {
                template += "\n\n--- CURRENT WORKSPACE CODEBASE ---\n{WORKSPACE}";
            }
            
            let finalPayload = template.replace('{CONTEXT}', historyContent || 'No history.').replace('{WORKSPACE}', workspaceMarkdown);

            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { action: "inject_payload", payload: finalPayload }, (response) => {
                if (handleLivenessError(status)) return;
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
