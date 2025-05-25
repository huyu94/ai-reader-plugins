document.getElementById("saveBtn").addEventListener('click', () => {
    const apiKey = document.getElementById("apiKey").value;
    chrome.storage.sync.set({apiKey: apiKey}, () => {
        document.getElementById("status").textContent = "保存成功!";
        setTimeout(() => {
            document.getElementById("status").textContent = "";
        }, 1500);
    });
});

// 页面加载时回显
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get('apiKey', (data) => {
        if (data.apiKey) {
            document.getElementById("apiKey").value = data.apiKey;
        }
    })
});