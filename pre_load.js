const { contextBridge, ipcRenderer } = require("electron");

// 기존 스토리지 기능
contextBridge.exposeInMainWorld("storage", {
  get(key) {
    return window.localStorage.getItem(key);
  },
  set(key, value) {
    return window.localStorage.setItem(key, value);
  }
});

// 🔥 새롭게 추가하는 AI 기능 통로
contextBridge.exposeInMainWorld("electronAPI", {
  // 메인 프로세스의 'get-ai-summary' 채널로 데이터를 보내고 결과를 기다림
  getAISummary: (activities) => ipcRenderer.invoke("get-ai-summary", activities)
});