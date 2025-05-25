chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "ai summarize",
        title: "AI总结",
        contexts: ["selection"]
    })
});



chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "ai summarize") {
        // 1. 立即弹出loading popup
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            args: ["AI总结生成中..."],
            func: displayPopup
        });

        // 2. 流式请求和流式输出
        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            func: function() {
                window.__aiStreamBuffer = '';
            }
        });
        await callGLMAPIStream(info.selectionText, tab.id);
    }


});


async function callGLMAPI(text) {
    // 获取 storage 里的apiKey
    const apiKey = await new Promise((resolve) => {
        chrome.storage.sync.get('apiKey', (data) => {
            resolve(data.apiKey || '');
        })
    })

    const apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions"; // 替换为实际的API URL
    console.log("API URL:", apiUrl);
    console.log("API Key:", apiKey);
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
            model: "glm-4",
            messages: [
                {
                    role: "system",
                    content: "你是一个AI助手，擅长总结与分析,你需要将以下的内容进行中文总结.给出核心内容的大纲,用1,2,3,4来表示,每个小段都要给出合适的总结.最终对总体部分并给出自己的看法。"
                },
                {
                    role: "user",
                    content: "请对以下部分进行总结" + text
                }
            ],
            // stream: true, // 开启流式响应
        })
    });

    console.log("Response status:", response.status);
    if (!response.ok) {
        // throw new Error("网络错误或API调用失败");
        return '网络错误或API调用失败';
    }
    
    const data = await response.json();
    console.log("Response headers:", data);
    return data.choices[0].message.content; // 假设API返回的JSON中有一个summary字段
}

async function callGLMAPIStream(text, tabId) {
    const apiKey = await new Promise((resolve) => {
        chrome.storage.sync.get('apiKey', (data) => {
            resolve(data.apiKey || '');
        })
    });
    const apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
    const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
            model: "glm-4",
            messages: [
                {
                    role: "system",
                    content: "你是一个AI助手，擅长总结与分析,你需要将以下的内容进行中文总结.给出核心内容的大纲,用1,2,3,4来表示,每个小段都要给出合适的总结.最终对总体部分并给出自己的看法。"
                },
                {
                    role: "user",
                    content: "请对以下部分进行总结" + text
                }
            ],
            stream: true
        })
    });
    if (!response.ok || !response.body) {
        chrome.scripting.executeScript({
            target: {tabId},
            args: ["网络错误或API调用失败"],
            func: displayPopup
        });
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let buffer = '';
    while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            // 解析流式数据，假设每行是一个json对象
            const lines = buffer.split('\n');
            buffer = lines.pop(); // 最后一行可能不完整，留到下次
            for (const line of lines) {
                if (line.trim().startsWith('data:')) {
                    const jsonStr = line.replace('data:', '').trim();
                    if (jsonStr && jsonStr !== '[DONE]') {
                        try {
                            const data = JSON.parse(jsonStr);
                            const content = data.choices?.[0]?.delta?.content || '';
                            if (content) {
                                chrome.scripting.executeScript({
                                    target: {tabId},
                                    args: [content],
                                    func: function(chunk) {
                                        let pre = document.getElementById('glm-summary');
                                        if (pre) {
                                            if (!window.__aiStreamBuffer) {
                                                pre.innerHTML = '';
                                                window.__aiStreamBuffer = true;
                                            }
                                            // 只处理**加粗**和换行
                                            function markdownToHtml(md) {
                                                if (!md) return '';
                                                return md.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
                                            }
                                            pre.innerHTML += markdownToHtml(chunk);
                                        }
                                    }
                                });
                            }
                        } catch (e) {}
                    }
                }
            }
        }
    }
}


function displayPopup(summary) {
    let popup = document.getElementById('ai-repsonse');
    if (!popup) {
        popup = document.createElement("div");
        popup.id = 'ai-repsonse';
        popup.style.position = "fixed";
        popup.style.top = "10px";
        popup.style.right = "10px";
        popup.style.zIndex = 10000;
        popup.style.padding = "20px";
        popup.style.maxWidth = "350px";
        popup.style.maxHeight = "600px";
        popup.style.backgroundColor = "#fff";
        popup.style.borderRadius = "8px";
        popup.style.overflowY = "auto";
        popup.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
        popup.style.fontSize = "14px";
        popup.style.fontFamily = "Arial, sans-serif";
        popup.innerHTML = `
            <strong style="color: #222;">AI总结:</strong>
            <div id="glm-summary" style="margin: 10px 0; white-space: pre-wrap; color: #222;"></div>
            <button id="glm-close-btn" style="
                border: none;
                padding: 8px 12px;
                margin-top: 10px;
                border-radius: 5px;
                color: white;
                background-color: #007bff;
                cursor: pointer;
            ">
            关闭
            </button>
        `;
        document.body.appendChild(popup);
        document.getElementById('glm-close-btn').addEventListener('click', () => {
            popup.remove();
        });
    }
    // 用 textContent 避免 XSS 并保证颜色生效
    let pre = document.getElementById('glm-summary');
    if (pre) pre.innerHTML = markdownToHtml(summary);
}

// 简单的Markdown转HTML（只处理**加粗**）
function markdownToHtml(md) {
    if (!md) return '';
    return md
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}
