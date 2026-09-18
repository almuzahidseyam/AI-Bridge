document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['customPrompt'], (result) => {
        if (result.customPrompt) {
            document.getElementById('promptBox').value = result.customPrompt;
        }
    });
});

document.getElementById('saveBtn').addEventListener('click', () => {
    let newPrompt = document.getElementById('promptBox').value;
    chrome.storage.local.set({ customPrompt: newPrompt }, () => {
        let status = document.getElementById('status');
        status.innerText = '✅ Saved successfully!';
        setTimeout(() => status.innerText = '', 2000);
    });
});
