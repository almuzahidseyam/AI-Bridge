document.getElementById('exportBtn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    status.innerText = "Extracting chat context...";
    
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
        if (response && response.success) {
            status.innerText = "✅ Context saved! Open another AI and click Inject.";
            status.style.color = "#3fb950";
        } else {
            status.innerText = "❌ Failed to extract context.";
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
            status.innerText = "🚀 Injection complete! Press Send.";
            status.style.color = "#3fb950";
        } else {
            status.innerText = "❌ Failed to inject context.";
            status.style.color = "#f85149";
        }
    });
});
