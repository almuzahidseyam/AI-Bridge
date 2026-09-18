// Background service worker for handling storage across tabs
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveContext') {
        chrome.storage.local.set({ aiBridgeContext: request.data }, () => {
            sendResponse({ success: true });
        });
        return true; 
    } else if (request.action === 'getContext') {
        chrome.storage.local.get(['aiBridgeContext'], (result) => {
            sendResponse({ data: result.aiBridgeContext });
        });
        return true; 
    }
});
