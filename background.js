// 创建右键菜单项
chrome.contextMenus.create({
  id: "aiSummary",
  title: "AI 总结",
  contexts: ["selection"]
});

// 监听右键菜单项点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "aiSummary") {
    const selectedText = info.selectionText;
    // 这里需要添加调用 AI 接口进行总结的代码
    console.log('选中的文本: ', selectedText);
  }
});