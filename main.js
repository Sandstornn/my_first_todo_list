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
      사용자의 한 주간 할 일 목록을 분석해서 짧은 격려와 조언을 해줘.
      
      [규칙]
      1. 팩트를 기반해서 전달해줘 말투는 비문학 책 쓰듯이. 되도록, 유려한 문장 보다는 알아듣기 쉬운 간결한 문장으로 적어줘.
      2. 조언은 구체적이고 실천 가능한 형태로 해줘.
      3. 전체적으로 한 눈에 보기 쉽도록 4줄 정도로 요약해줘.
      4. 답변은 한국어로 해줘.
      5. 답변에 **, ##, -, * 같은 마크다운 기호를 절대 사용하지 마세요.
      6. 소제목이 필요하다면 기호 없이 그냥 한 줄을 띄우고 제목만 적어주세요.
      
      활동 내역: ${activities.join(", ")}
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