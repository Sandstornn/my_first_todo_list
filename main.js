const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

// 저장소 꼬이는 문제 때문에 single instance lock 적용
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow;

function createWindow() {
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);

// 두 번째 실행 시 기존 창 앞으로
app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});


app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
