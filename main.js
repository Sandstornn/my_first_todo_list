require('dotenv').config(); // ✅ .env 파일 로드
const { app, BrowserWindow, Menu, ipcMain } = require("electron"); // ✅ ipcMain 추가
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai"); // ✅ Gemini 라이브러리 추가

// 1. Gemini AI 초기화
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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
      preload: path.join(__dirname, "pre_load.js"),
      contextIsolation: true,
      nodeIntegration: false // 보안을 위해 권장
    }
  });

  mainWindow.loadFile("index.html");
}

ipcMain.handle('get-ai-summary', async (event, activities) => {
  try {
    // 키가 제대로 로드되었는지 확인용 로그 (앞부분 4자리만 출력)
    console.log("키 로드 확인:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 4) + "****" : "없음");

    // ✅ 프롬프트를 구체적으로 작성합니다.
    const prompt = `
  너는 자기계발 전문가야.
  
  [분석 요청]
  1. 사용자가 설정한 '상위 목표(연간/월간/주간)'와 실제 '날짜별 할 일'을 대조해.
  2. 연간/월간/주간 목표 달성에 하루 하루 체크리스트가 얼마나 부합하는지 분석해.
  3. 빈말은 하지 말고 실제로 있었던 활동들을 기반으로 솔직하게 분석해줘. 목표 달성에 도움이 되는 활동과 그렇지 않은 활동을 구분해서 알려줘.
  4. 정리해서 3개 정도 항목, 각 항목 당 3줄으로 요약된 것만 보여줘.
  5. 마지막에 요약해서 잘한 점, 못한 점, 개선할 점을 각각 1줄로 알려줘.

  [주의사항]
  - 답변에 **, ##, -, * 와 같은 마크다운 기호를 절대 사용하지 마세요.
  - 모든 답변은 순수 텍스트(Plain Text)로만 구성해야 합니다.

  데이터 목록:
  ${activities.join("\n")}
`;

    const result = await model.generateContent(prompt);
    
    // 안전하게 텍스트 추출
    const response = await result.response;
    const text = typeof response.text === 'function' ? response.text() : response.text;
    
    return text;
  } catch (error) {
    console.error("❌ Gemini API 에러 상세:", error); // 터미널에 에러 원인이 찍힙니다.
    throw error; // 렌더러의 catch 블록으로 에러 전달
    // return `메인 에러: ${error.message}`;
  }
});

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