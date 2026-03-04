let selectedDate = null;
let confirmResolve = null;
let openedTodoIndex = null;

/* ---------- 현재 modal 모드(어디에 저장할지) ---------- */
let currentMode = "day"; 
// "day" | "year" | "month" | "week"

/* ---------- util ---------- */
function getStore() {
  const raw = localStorage.getItem("todos");
  if (!raw) {
    return {
      todos: {},
      goals: { year: {}, month: {}, week: {} },
      routines: [],
      lastRoutineDate: null,
      aiCache: {}
    };
  }

  let parsed = JSON.parse(raw);

  // 🔥 레거시 구조 대응 (데이터 날림 방지)
  const hasLegacy = Object.keys(parsed).some(k => k.includes("-"));
  if (hasLegacy && !parsed.todos) {
    parsed = { todos: parsed };
  }

  // 필수 구조 보강
  parsed.todos = parsed.todos || {};
  parsed.goals = parsed.goals || { year: {}, month: {}, week: {} };
  parsed.goals.year = parsed.goals.year || {};
  parsed.goals.month = parsed.goals.month || {};
  parsed.goals.week = parsed.goals.week || {};
  parsed.routines = parsed.routines || [];
  parsed.lastRoutineDate = parsed.lastRoutineDate || null;
  parsed.aiCache = parsed.aiCache || {};

  return parsed;
}
function setStore(data) {
  localStorage.setItem("todos", JSON.stringify(data));
}

/////////////////////////////////////////////////////////////////
/* routine function */
/* 루틴을 오늘 체크리스트에 추가해주는 함수 수정 */
function checkDailyRoutines() {
  const store = getStore();
  const today = new Date().toISOString().slice(0, 10);

  if (store.lastRoutineDate === today) return;
  if (!store.routines || store.routines.length === 0) return;

  store.todos[today] = store.todos[today] || [];

  store.routines.forEach(routineObj => {
    // 중복 체크
    const exists = store.todos[today].some(t => t.text === routineObj.text);
    
    if (!exists) {
      // 세부 항목(subs)이 있다면, 그것들도 완료 상태를 false로 초기화하여 복사
      const newSubs = (routineObj.subs || []).map(s => ({
        text: s.text,
        done: false // 매일 새로 시작하므로 false
      }));

      store.todos[today].push({
        text: routineObj.text,
        done: false,
        subs: newSubs // 복사된 세부 항목 삽입
      });
    }
  });

  store.lastRoutineDate = today;
  setStore(store);
}
/* ---------- report detail modal ---------- */

/* ---------- function rendering report detail modal ---------- */
async function openReportDetail(title, dateList) {
  const store = getStore();
  const content = document.getElementById("reportDetailContent");
  const backdrop = document.getElementById("reportDetailBackdrop");
  const closeX = document.getElementById("btnReportCloseX");

  // 1. 제목 및 내용 초기화
  document.getElementById("reportDetailTitle").textContent = title;
  content.innerHTML = "";

  // 2. 닫기 버튼(X) 이벤트 연결
  if (closeX) {
    closeX.onclick = () => backdrop.classList.add("hidden");
  }

  

  // 3. AI 섹션 동적 생성
  const aiSection = document.createElement("div");
  aiSection.className = "ai-summary-container";
  aiSection.innerHTML = `
    <div class="ai-header">🤖 Gemini AI 분석</div>
    <div id="aiSummaryText" class="ai-summary-text">목표와 세부 실행 내역을 대조 분석 중입니다...</div>
  `;
  content.appendChild(aiSection);

  // AI에게 전달할 데이터 수집
  let allActivities = [];

  // renderer.js 내 openReportDetail 함수 중 데이터 수집 부분
const collectGoals = (goalObj, typeLabel) => {
  Object.keys(goalObj).forEach(key => {
    if (title.includes(key.split('-')[0])) { 
      goalObj[key].forEach(g => {
        // '목표'임을 강조하고 상태를 명확히 전달
        allActivities.push(`[필독-상위 ${typeLabel}] 명칭: "${g.text}", 상태: ${g.done ? "달성함" : "아직 미달성(진행중)"}`);
      });
    }
  });
};

  collectGoals(store.goals.year, "연간 목표");
  collectGoals(store.goals.month, "월간 목표");
  collectGoals(store.goals.week, "주간 목표");

  // --- B. 일일 활동 및 세부 항목(subs) 수집 ---
  dateList.forEach(date => {
    if (!store.todos[date]) return;

    const dayBlock = document.createElement("div");
    dayBlock.className = "report-day";
    dayBlock.innerHTML = `<div class="report-day-title">${formatDateKorean(date)}</div>`;

    // renderer.js의 openReportDetail 함수 내부 수정
    store.todos[date].forEach(t => {
      // 1. 메인 할 일 정보 생성
      let activityInfo = `[${date}] 할 일: ${t.text} (${t.done ? "완료" : "미완료"})`;

      // 2. 해당 할 일에 달린 세부 항목(대댓글)들을 바로 아래에 붙여줌
      if (t.subs && t.subs.length > 0) {
        const subDetails = t.subs
          .filter(s => s.text && s.text.trim() !== "") // 내용이 있는 것만 포함
          .map(s => `   └ [대댓글/세부사항]: ${s.text} (${s.done ? "완료" : "미완료"})`)
          .join("\n");
        
        activityInfo += `\n${subDetails}`;
      }

      // AI 전송 배열에 추가
      allActivities.push(activityInfo);

      // (참고) 화면에 보이는 리스트 렌더링 로직은 기존대로 유지
      const line = document.createElement("div");
      line.className = `report-item ${t.done ? "done" : "todo"}`;
      line.textContent = `${t.done ? "✔" : "✖"} ${t.text}`;
      dayBlock.appendChild(line);
    });
    content.appendChild(dayBlock);
  });

  backdrop.classList.remove("hidden");

  // 2. 캐시 확인 로직 도입
  // store.aiCache가 없으면 초기화
  store.aiCache = store.aiCache || {};
  
  const currentDataStr = JSON.stringify(allActivities);
  const cachedEntry = store.aiCache[title]; // 리포트 제목을 키로 사용

  
  // 4. AI 요약 호출
  const aiTextEl = document.getElementById("aiSummaryText");

  // 해당 리포트의 기존 데이터와 현재 데이터가 완전히 일치하는지 확인
  if (cachedEntry && cachedEntry.data === currentDataStr) {
    console.log(`[AI Cache Hit] "${title}" 리포트의 변경사항이 없어 캐시된 내용을 표시합니다.`);
    
    aiTextEl.innerText = cachedEntry.summary;
    // 통신 없이 여기서 종료
    return;
  }

  if (allActivities.length > 0) {
    try {
      aiTextEl.textContent = "🤖 목표 대비 실행력을 분석하고 있습니다...";
      const summary = await window.electronAPI.getAISummary(allActivities);
      
      if (summary) {
        // 줄바꿈 가공 후 화면 표시
        const cleanSummary = summary
          .replace(/[#*]/g, '')
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        aiTextEl.innerText = cleanSummary;

        // 새로운 결과를 캐시에 저장하고 로컬 스토리지에 기록합니다.
        store.aiCache[title] = {
          data: currentDataStr,  // 현재 분석한 원본 데이터 문자열
          summary: cleanSummary // AI의 분석 결과
        };
        setStore(store); // 변경된 store를 localStorage에 저장
      }
    } catch (err) {
      aiTextEl.textContent = `⚠️ 통신 실패: ${err.message}`;
      aiTextEl.style.color = "#ef4444";
    }
  }
}

/* ---------- 주 클릭시 날짜 범위 ---------- */
function getWeekRange(year, month, weekIndex) {
  const startDay = (weekIndex - 1) * 7 + 1;
  const start = new Date(year, month, startDay);
  const end = new Date(year, month, startDay + 6);
  return getDatesInRange(start, end);
}
/* ---------- 월 클릭시 날짜 범위 ---------- */
function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return getDatesInRange(start, end);
}
/* ---------- 날짜 범위 생성 유틸 ---------- */
function getDatesInRange(start, end) {
  const dates = [];
  const cur = new Date(start);

  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}
/* ---------- 날짜 포맷 유틸 ---------- */
function formatDateKorean(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
}
/////////////////////////////////////////////////////////////////


/* ---------- get last 12 months ---------- */
function getLast12Months() {
  const now = new Date();

  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);

    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getMonth() + 1}월`
    };
  });
}


/* ---------- calculate progress ---------- */
function calcProgress(todos) {
  if (!todos || todos.length === 0) return 0;

  const done = todos.filter(t => t.done).length;
  return Math.round((done / todos.length) * 100);
}

function progressClass(p) {
  if (p === 0) return "p0";
  if (p < 25) return "p25";
  if (p < 50) return "p50";
  if (p < 75) return "p75";
  return "p100";
}

/* ---------- function rendering report ---------- */
function renderReport() {
  const store = getStore();
  const months = getLast12Months();

  const monthSummaryEl = document.getElementById("monthSummary");
  const matrixEl = document.getElementById("progressMatrix");

  if (!monthSummaryEl || !matrixEl) return;

  /* ---------- 월별 요약 ---------- */
  monthSummaryEl.innerHTML = "";

  months.forEach(m => {
    let total = 0;
    let done = 0;

    Object.keys(store.todos).forEach(date => {
      if (date.startsWith(m.key)) {
        store.todos[date].forEach(t => {
          total++;
          if (t.done) done++;
        });
      }
    });

    const percent = total ? Math.round((done / total) * 100) : 0;

    // 🔥 month-card를 DOM으로 생성
    const monthCard = document.createElement("div");
    monthCard.className = "month-card";
    monthCard.innerHTML = `
      ${m.label}
      <div class="percent">${percent}%</div>
    `;

    // ✅ 월 클릭 이벤트
    const [year, month] = m.key.split("-").map(Number);
    monthCard.onclick = () => {
      const dates = getMonthRange(year, month - 1);
      openReportDetail(`${year}년 ${month}월`, dates);
    };

    monthSummaryEl.appendChild(monthCard);
  });

  /* ---------- 월 × 주 진행률 ---------- */
  matrixEl.innerHTML = "";

  // 헤더
  matrixEl.appendChild(document.createElement("div"));
  months.forEach(m => {
    const header = document.createElement("div");
    header.className = "matrix-header";
    header.textContent = m.label;
    matrixEl.appendChild(header);
  });

  // 1~5주
  for (let week = 1; week <= 5; week++) {
    const weekLabel = document.createElement("div");
    weekLabel.className = "week-label";
    weekLabel.textContent = `${week}주`;
    matrixEl.appendChild(weekLabel);

    months.forEach(m => {
      let weekTodos = [];

      Object.keys(store.todos).forEach(date => {
        if (!date.startsWith(m.key)) return;

        const d = new Date(date);
        const weekIndex = Math.ceil(d.getDate() / 7);
        if (weekIndex === week) {
          weekTodos.push(...store.todos[date]);
        }
      });

      const p = calcProgress(weekTodos);
      const showText = p > 0;
      const textClass = p >= 60 ? "inside" : "outside";

      // 🔥 heat-cell을 DOM으로 생성
      const cell = document.createElement("div");
      cell.className = "heat-cell";
      if (p > 0) cell.title = `${p}%`;

      cell.innerHTML = `
        <div class="bar">
          <div class="bar-fill" style="width:${p}%"></div>
          ${
            showText
              ? `<span class="bar-text ${textClass}">${p}%</span>`
              : ``
          }
        </div>
      `;

      // ✅ 주 클릭 이벤트
      const [year, month] = m.key.split("-").map(Number);
      cell.onclick = () => {
        const dates = getWeekRange(year, month - 1, week);
        openReportDetail(`${year}년 ${month}월 · ${week}주`, dates);
      };

      matrixEl.appendChild(cell);
    });
  }
}






/* ---------- export / import data ---------- */
function exportData() {
  const data = localStorage.getItem("todos") || "{}";
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "todo-data.json";
  a.click();

  URL.revokeObjectURL(url);

  alert("todo-data.json 파일이 다운로드 폴더에 저장되었습니다.");
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (typeof parsed !== "object") throw new Error();

      const oldStore = getStore();        // 기존 데이터
      const mergedStore = {               // ✅ merge
        ...oldStore,
        ...parsed
      };

      localStorage.setItem("todos", JSON.stringify(mergedStore));
      alert("데이터를 불러왔습니다.");
      location.reload();
    } catch(e) {
      alert("올바른 JSON 파일이 아닙니다.");
    }
  };
  reader.readAsText(file);
}


/* ---------- confirm modal ---------- */
function openConfirm(message,no_danger = false) {
  const backdrop = document.getElementById("confirmBackdrop");
  const yesBtn = document.getElementById("confirmYes");

  document.getElementById("confirmMessage").textContent = message;
  
  // ✅ 항상 초기화
  yesBtn.classList.remove("btn-danger");

  if (no_danger) {
    yesBtn.classList.add("btn");        // 일반 확인 (검정)
  } else {
    yesBtn.classList.add("btn-danger"); // 위험 확인 (빨강)
  }

  backdrop.classList.remove("hidden");

  return new Promise(resolve => {
    confirmResolve = resolve;
    requestAnimationFrame(() => {
      document.getElementById("confirmYes").focus();
    });
  });
}

function closeConfirm(result) {
  document.getElementById("confirmBackdrop").classList.add("hidden");
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

document.getElementById("confirmYes").onclick = () => closeConfirm(true);
document.getElementById("confirmNo").onclick  = () => closeConfirm(false);






/* ---------- modal ---------- */
function openModal(dateStr) {
  selectedDate = dateStr;
  openedTodoIndex = null;

if (currentMode === "routine") {
  document.getElementById("modalTitle").textContent = "Routine";
}else if (currentMode === "day") {
  document.getElementById("modalTitle").textContent = dateStr;
}else if (currentMode === "year") {
  document.getElementById("modalTitle").textContent = dateStr + "년 목표";
}else if (currentMode === "month") {
  document.getElementById("modalTitle").textContent = dateStr + "월 목표";
}else if (currentMode === "week") {
  document.getElementById("modalTitle").textContent = dateStr + "주간 목표";
}
  document.getElementById("modalBackdrop").classList.remove("hidden");

  loadTodos(dateStr);

  requestAnimationFrame(() => {
    document.getElementById("todoInput").focus();
  });
}

function closeModal() {
  document.getElementById("todoInput").value = "";
  document.getElementById("modalBackdrop").classList.add("hidden");
  selectedDate = null;
  openedTodoIndex = null;

  currentMode = "day";

  renderGoalPreview(); // 모달 닫을 때도 preview 갱신
}

/* ---------- todos ---------- */
function loadTodos(date) {
  const list = document.getElementById("todoList");
  list.innerHTML = "";

  const store = getStore();
  let todos = [];
  if (currentMode === "routine") {
    todos = store.routines; // 루틴 데이터 로드
  }
  else if (currentMode === "day") {
    todos = store.todos[date] || [];
  } else if (currentMode === "year") {
    todos = store.goals.year[date] || [];
  } else if (currentMode === "month") {
    todos = store.goals.month[date] || [];
  } else if (currentMode === "week") {
    todos = store.goals.week[date] || [];
  }

  // [Step 3] 스마트 정렬 로직 추가
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
  const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

  todos.sort((a, b) => {
    // 1. 완료 상태 우선 비교 (완료된 것은 무조건 뒤로)
    if (a.done !== b.done) return a.done ? 1 : -1;

    // 2. 미완료 항목 내에서의 정렬
    if (!a.done) {
      // 시간 문자열(HH:mm)을 분 단위 숫자로 변환
      const getTimeVal = (t) => {
        if (!t) return null;
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };

      const timeA = getTimeVal(a.time);
      const timeB = getTimeVal(b.time);

      // 시간이 지났는지 여부 확인 (오늘 날짜일 때만 적용)
      const isPassedA = timeA !== null && date === todayStr && timeA < currentTimeInMinutes;
      const isPassedB = timeB !== null && date === todayStr && timeB < currentTimeInMinutes;

      // 우선순위 점수 계산 (낮을수록 위로)
      const getPriority = (time, isPassed) => {
        if (time === null) return 1; // 2순위: 종일 일정
        if (isPassed) return 2;      // 3순위: 시간이 지난 일정
        return 0;                    // 1순위: 앞으로 올 일정
      };

      const priA = getPriority(timeA, isPassedA);
      const priB = getPriority(timeB, isPassedB);

      if (priA !== priB) return priA - priB;

      // 같은 그룹 내에서는 시간순으로 정렬
      if (timeA !== null && timeB !== null) return timeA - timeB;
    }

    return 0; // 나머지(둘 다 완료됨 등)는 순서 유지
  });


  todos.forEach((todo, idx) => {
    /* ---------- 상위 todo ---------- */
    const item = document.createElement("div");
    item.className = "todo-item";

    // 👉 여백 클릭 = sub 토글
    item.onclick = () => {
      openedTodoIndex = (openedTodoIndex === idx ? null : idx);
      loadTodos(date);
    };

    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "todo-check";
    check.checked = todo.done;
    check.onclick = e => e.stopPropagation();
    check.onchange = () => {
      todo.done = check.checked;
      saveTodos(date, todos);
    };

    const text = document.createElement("div");
    text.className = "todo-text";
    text.textContent = todo.text;
    text.contentEditable = true;
    text.onclick = e => e.stopPropagation();
    text.onblur = () => {
      todo.text = text.textContent;
      saveTodos(date, todos);
    };

    // 시간 버튼
    let timeWrapper = null;
    if(currentMode === "day"){
      timeWrapper = document.createElement("div");
timeWrapper.className = "todo-time-wrapper";
timeWrapper.onclick = e => e.stopPropagation(); // 부모 클릭(sub 토글) 방지

const renderDisplay = () => {
  timeWrapper.innerHTML = "";

  // 1. 시간이 없을 때 (All-day 상태)
  if (!todo.time) {
    const clockBtn = document.createElement("div");
    clockBtn.className = "todo-time-display";
    clockBtn.textContent = "🕒";
    clockBtn.onclick = () => {
      todo.time = "12:00"; // 클릭 시 기본값 부여
      renderDisplay();     // 즉시 입력창으로 전환
    };
    timeWrapper.appendChild(clockBtn);
  } 
  // 2. 시간이 있을 때 (시간 지정 상태)
  else {
    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.className = "todo-time-input-native";
    timeInput.value = todo.time;

    // 시간 변경 시 저장
    timeInput.onchange = () => {
      todo.time = timeInput.value || null;
      saveTodos(date, todos);
    };

    // 💡 [추가] 시간 제거 버튼 (X)
    const clearBtn = document.createElement("button");
    clearBtn.className = "todo-time-clear-inline";
    clearBtn.textContent = "✕";
    clearBtn.onclick = () => {
      todo.time = null; // 시간 데이터 삭제
      saveTodos(date, todos);
      loadTodos(date); // UI 갱신 (다시 시계 아이콘으로)
    };

    timeWrapper.append(timeInput, clearBtn);
  }
};
      renderDisplay();
  }

    const del = document.createElement("button");
    del.className = "todo-del";
    del.textContent = "✕";
    del.onclick = e => {
      e.stopPropagation();
      todos.splice(idx, 1);
      saveTodos(date, todos);
      loadTodos(date);
    };

    // 목표에서는 시간 떼기
    if (timeWrapper) {
      item.append(check, text, timeWrapper, del);
    } else {
      item.append(check, text, del);
    }
    list.appendChild(item);

    /* ---------- 🔥 sub를 "바로 아래"에 끼워 넣기 ---------- */
    if (openedTodoIndex === idx) {
      const subWrap = document.createElement("div");
      subWrap.className = "todo-sub-wrap";

      (todo.subs || []).sort((a, b) => {
        if (a.done === b.done) return 0;
        return a.done ? 1 : -1;
      }).forEach((sub, sIdx) => {
        const subItem = document.createElement("div");
        subItem.className = "todo-sub-item";

        const subCheck = document.createElement("input");
        subCheck.type = "checkbox";
        subCheck.checked = sub.done;
        subCheck.onchange = () => {
          sub.done = subCheck.checked;
          saveTodos(date, todos);
        };

        const subText = document.createElement("div");
        subText.className = "todo-text todo-sub-input";
        subText.contentEditable = true;
        subText.textContent = sub.text||"";
        subText.dataset.placeholder = "세부 항목을 입력하고 Enter…";
        subText.onblur = () => {
          sub.text = subText.textContent.trim();
          saveTodos(date, todos);
        };

        const subDel = document.createElement("button");
        subDel.textContent = "✕";
        subDel.onclick = () => {
          todo.subs.splice(sIdx, 1);
          saveTodos(date, todos);
          loadTodos(date);
        };

        subItem.append(subCheck, subText, subDel);
        subWrap.appendChild(subItem);
      });

      const addSub = document.createElement("button");
      addSub.textContent = "+ 세부 항목 추가";
      addSub.onclick = () => {
        todo.subs = todo.subs || [];
        todo.subs.push({ text: "", done: false });
        saveTodos(date, todos);
        loadTodos(date);
      };

      subWrap.appendChild(addSub);
      list.appendChild(subWrap);
    }
  });
}

function saveTodos(date, todos) {
  const store = getStore();

  if (currentMode === "routine") {
    store.routines = todos;
  } else if (currentMode === "day") {
    store.todos[date] = todos;
  } else if (currentMode === "year") {
    store.goals.year[date] = todos;
  } else if (currentMode === "month") {
    store.goals.month[date] = todos;
  } else if (currentMode === "week") {
    store.goals.week[date] = todos;
  }

  setStore(store);

  // 화면 갱신
  if (window.mainCalendar) {
    window.mainCalendar.refetchEvents();
  }
}

/* ---------- events ---------- */
window.onload = () => {
  checkDailyRoutines(); // 앱 시작 시 루틴 체크

  /* window.onload 내부의 캘린더 설정 부분 */
  const calendar = new FullCalendar.Calendar(document.getElementById("calendar"), {
  initialView: "dayGridMonth",
  locale: "ko",
  height: "100%", 
  fixedWeekCount: false, // 💡 필요할 때만 6주 표시
  headerToolbar: false,
  dayMaxEvents: 2, 
  
  events: function(info, successCallback, failureCallback) {
    successCallback(getFilteredEvents(info.startStr, info.endStr));
  },

  // 💡 [핵심] 날짜 칸(Cell)이 그려질 때 호출되는 함수
  dayCellDidMount: function(arg) {
    const cellEl = arg.el;
    // 날짜 문자열 추출 (YYYY-MM-DD)
    const y = arg.date.getFullYear();
    const m = String(arg.date.getMonth() + 1).padStart(2, '0');
    const d = String(arg.date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // 마우스가 칸 안으로 들어왔을 때
    /* renderer.js - dayCellDidMount 내부 mouseenter 수정 */
cellEl.addEventListener('mouseenter', () => {
  const store = getStore();
  const dayTasks = store.todos[dateStr] || [];
  if (dayTasks.length === 0) return;

  const sortedList = [...dayTasks].sort((a, b) => {
    if (a.time && !b.time) return -1;
    if (!a.time && b.time) return 1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
  });

  const popover = document.createElement("div");
  popover.className = "calendar-day-popover";
  
  const listHtml = sortedList.map(t => {
    const timeTag = t.time ? `<span class="tip-time">[${t.time}]</span> ` : `<span class="tip-check">[체크]</span> `;
    const doneClass = t.done ? "done" : "";
    return `<div class="tip-item ${doneClass}">${timeTag}${t.text}</div>`;
  }).join('');

  popover.innerHTML = `<strong>📅 ${m}월 ${d}일 목록</strong><hr>${listHtml}`;
  document.body.appendChild(popover); // 💡 높이 측정을 위해 먼저 추가

  const rect = cellEl.getBoundingClientRect();
  const popWidth = popover.offsetWidth;
  const popHeight = popover.offsetHeight; // 💡 렌더링된 실제 높이 측정
  const dayOfWeek = arg.date.getDay(); 

  // 1️⃣ 좌우 배치 로직 (기존 유지)
  if (dayOfWeek >= 4) {
    popover.style.left = (rect.left - popWidth - 10) + "px";
    popover.classList.add("left-side"); 
  } else {
    popover.style.left = (rect.right + 10) + "px";
  }

  // 2️⃣ 💡 [확장] 줄(Row) 계산 로직 추가
  // 달력 뷰의 시작일로부터 며칠이 지났는지 계산하여 현재 칸의 줄 번호를 구합니다.
  const startOfView = arg.view.activeStart;
  const diffDays = Math.floor((arg.date - startOfView) / (1000 * 60 * 60 * 24));
  const rowIndex = Math.floor(diffDays / 7); // 0=1행, 1=2행, 2=3행, 3=4행...

  // 3️⃣ 💡 [상하 배치] 3번째 줄(rowIndex 2)부터는 위로 표시
  if (rowIndex >= 2) { 
    // 3, 4, 5, 6번째 줄: 팝오버 바닥을 칸 바닥에 맞춤 (위로 솟음)
    popover.style.top = (rect.bottom + window.scrollY - popHeight) + "px";
    popover.classList.add("pop-upward");
  } else {
    // 1, 2번째 줄: 기존처럼 위에서 아래로 배치
    popover.style.top = (rect.top + window.scrollY) + "px";
  }

  cellEl._popover = popover;
  cellEl.style.backgroundColor = "#f3f4f6";
});
    // 마우스가 칸 밖으로 나갔을 때
    cellEl.addEventListener('mouseleave', () => {
      if (cellEl._popover) {
        cellEl._popover.remove();
        cellEl._popover = null;
      }
      cellEl.style.backgroundColor = ""; // 색상 원복
    });
  },

  dateClick(info) {
    currentMode = "day";
    openModal(info.dateStr);
  }
});
  calendar.render();
  window.mainCalendar = calendar;

// 여기부터
 /* =========================
     여기부터 월 네비 코드
     ========================= */

  let currentDate = calendar.getDate();

  function renderMonthStrip() {
    const strip = document.getElementById("monthStrip");
    strip.innerHTML = "";

    const base = new Date(currentDate);
    base.setDate(1);

    for (let i = -2; i <= 2; i++) {
      const d = new Date(base);
      d.setMonth(base.getMonth() + i);

      const el = document.createElement("div");
      el.className = "month-item" + (i === 0 ? " active" : "");
      el.textContent = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}`;

      if(el.classList.contains("active")){
        el.onclick = openYmPicker;
      }
      else{
      el.onclick = () => {
        
        currentDate = d;
        calendar.gotoDate(d);
        renderMonthStrip();
      };
    }
      strip.appendChild(el);
    }
  }

  /* 화살표 너무 짜친다.
  document.getElementById("monthPrev").onclick = () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    calendar.gotoDate(currentDate);
    renderMonthStrip();
  };

  document.getElementById("monthNext").onclick = () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    calendar.gotoDate(currentDate);
    renderMonthStrip();
  };
  */
  renderMonthStrip();

  /* 월 선택 scroll picker (순환 로직 및 휠 방식 반영) */
  /* 월 선택 scroll picker (진짜 휠 방식 순환 로직) */
let pickerYear;
let pickerMonth;


function openYmPicker() {
  const backdrop = document.getElementById("ymBackdrop");
  const yearList = document.getElementById("yearList");
  const monthList = document.getElementById("monthList");

  // 1. 초기값 설정
  pickerYear = currentDate.getFullYear();
  pickerMonth = currentDate.getMonth();

  backdrop.classList.remove("hidden");

  function scrollItemToCenter(container, item) {
    if (!item) return;
    const cRect = container.getBoundingClientRect();
    const iRect = item.getBoundingClientRect();
    const scrollTop = (iRect.top + iRect.height / 2) - (cRect.top + cRect.height / 2);
    container.scrollBy({ top: scrollTop, behavior: "smooth" });
  }

  // --- [왼쪽] 연도 바퀴 (독립형 무한 느낌) ---
  function renderYears() {
    yearList.innerHTML = "";
    // 현재 해 기준 ±30년 생성
    for (let y = pickerYear - 30; y <= pickerYear + 30; y++) {
      const el = document.createElement("div");
      el.className = "ym-item" + (y === pickerYear ? " active" : "");
      el.textContent = `${y}년`;
      el.onclick = () => {
        pickerYear = y;
        yearList.querySelectorAll(".ym-item").forEach(i => i.classList.remove("active"));
        el.classList.add("active");
        scrollItemToCenter(yearList, el);
      };
      yearList.appendChild(el);
    }
    requestAnimationFrame(() => {
      const active = yearList.querySelector(".ym-item.active");
      if (active) scrollItemToCenter(yearList, active);
    });
  }

  // --- [오른쪽] 월 바퀴 (진짜 무한 순환형) ---
  function renderMonths() {
    monthList.innerHTML = "";
    
    // 무한 휠 느낌을 위해 1~12월을 5세트 반복 (총 60개)
    for (let loop = 0; loop < 5; loop++) {
      for (let m = 0; m < 12; m++) {
        const el = document.createElement("div");
        // 5세트 중 정중앙(index 2) 블록의 해당 월을 초기 active로 설정
        const isInitialActive = (loop === 2 && m === pickerMonth);
        el.className = "ym-item" + (isInitialActive ? " active" : "");
        el.textContent = `${m + 1}월`;
        el.dataset.month = m;

        el.onclick = () => {
          pickerMonth = m;
          monthList.querySelectorAll(".ym-item").forEach(item => item.classList.remove("active"));
          el.classList.add("active");
          scrollItemToCenter(monthList, el);
        };
        monthList.appendChild(el);
      }
    }

    requestAnimationFrame(() => {
      // 5개 세트 중 정중앙(2번째 인덱스) 세트로 스크롤을 먼저 보내서 무한 느낌을 줍니다.
      const monthItems = monthList.querySelectorAll(`[data-month="${pickerMonth}"]`);
      const centerMonth = monthItems[2]; 
      if (centerMonth) scrollItemToCenter(monthList, centerMonth);
    });
  }

  renderYears();
  renderMonths();
}

// --- [확인 버튼] 스트립 5개 노출 로직 연동 ---
document.getElementById("btnYmConfirm").onclick = () => {
  // 1. 선택한 연/월로 기준 날짜 변경
  currentDate = new Date(pickerYear, pickerMonth, 1);
  calendar.gotoDate(currentDate);
  
  // 2. 상단 스트립 렌더링 (이미 코드에 있는 -2~+2 로직이 작동함)
  renderMonthStrip(); 
  closeYmPicker();
};
function closeYmPicker() {
  document.getElementById("ymBackdrop").classList.add("hidden");
}

document.getElementById("btnYmConfirm").onclick = () => {
  currentDate = new Date(pickerYear, pickerMonth, 1);
  calendar.gotoDate(currentDate);
  renderMonthStrip();
  closeYmPicker();
};

document.getElementById("btnYmClose").onclick = closeYmPicker;

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeYmPicker();
});

// 여기까지



  document.getElementById("btnClose").onclick = closeModal;

document.getElementById("btnAdd").onclick = () => {
  const input = document.getElementById("todoInput");
  if (!input.value || !selectedDate) return;

  const store = getStore();
  let todos = [];

  // 현재 모드에 따라 데이터 배열 선택
  if (currentMode === "routine") {
    todos = store.routines || [];
  } 
  else if (currentMode === "day") {
    todos = store.todos[selectedDate] || [];
  } 
  else if (currentMode === "year") {
    todos = store.goals.year[selectedDate] || [];
  } 
  else if (currentMode === "month") {
    todos = store.goals.month[selectedDate] || [];
  } 
  else if (currentMode === "week") {
    todos = store.goals.week[selectedDate] || [];
  }

  // 루틴 모드에서도 subs 배열을 함께 넣어줌
  todos.push({ text: input.value, done: false, subs: [] });

  saveTodos(selectedDate, todos); //

  input.value = "";
  loadTodos(selectedDate);
  renderGoalPreview(); 
  input.focus();
};

  document.getElementById("btnClearDone").onclick = () => {
    if (!selectedDate) return;

    const store = getStore();
    if (currentMode === "day") {
      store.todos[selectedDate] =
        (store.todos[selectedDate] || []).filter(t => !t.done);
      }
    else  if (currentMode === "year") {
  store.goals.year[selectedDate] =
    (store.goals.year[selectedDate] || []).filter(t => !t.done);
}
else if (currentMode === "month") {
  store.goals.month[selectedDate] =
    (store.goals.month[selectedDate] || []).filter(t => !t.done);
}
else if (currentMode === "week") {
  store.goals.week[selectedDate] =
    (store.goals.week[selectedDate] || []).filter(t => !t.done);
}
    setStore(store);
    loadTodos(selectedDate);
  };

  document.getElementById("btnDeleteDay").onclick = async () => {
    if (!selectedDate) return;

    const ok = await openConfirm("이 날짜의 모든 할 일을 삭제할까요?",{no_danger:true});
    if (!ok) return;

    const store = getStore();
    delete store.todos[selectedDate];
    setStore(store);

    closeModal();
  };

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!document.getElementById("confirmBackdrop").classList.contains("hidden")) {
        closeConfirm(false);
      } else if (!document.getElementById("modalBackdrop").classList.contains("hidden")) {
        closeModal();
      }
    }
  });
  // =========================
  // 🔽 페이지 슬라이드 코드 (맨 마지막!)
  // =========================
  const wrapper = document.getElementById("pageWrapper");

  document.getElementById("toReport")?.addEventListener("click", () => {
    wrapper.classList.add("show-report");

    // ✅ 리포트 렌더링 여기서 호출
    renderReport();
  });

  document.getElementById("toCalendar")?.addEventListener("click", () => {
    wrapper.classList.remove("show-report");
  });

  // =========================
// export / import 이벤트 연결
// =========================
document.getElementById("btnExportCalendar")
  ?.addEventListener("click", exportData);

document.getElementById("btnExportReport")
  ?.addEventListener("click", exportData);

document.getElementById("fileImportCalendar")
  ?.addEventListener("change", e => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });

document.getElementById("fileImportReport")
  ?.addEventListener("change", e => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });


  // =========================
// 🎯 Goal + 버튼 → 기존 modal 재사용
// =========================

document.querySelectorAll(".goal-open").forEach(btn => {
  btn.addEventListener("click", () => {

    const type = btn.dataset.type; // year / month / week
    currentMode = type;

    const today = new Date();

    if (type === "year") {
      selectedDate = String(today.getFullYear());
    }

    if (type === "month") {
      selectedDate =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0");
    }

    if (type === "week") {
      const week = Math.ceil(today.getDate() / 7);
      selectedDate =
        today.getFullYear() +
        "-" +
        String(today.getMonth() + 1).padStart(2, "0") +
        "-W" +
        week;
    }

    openModal(selectedDate);
  });
});
  // 루틴 관리 버튼 클릭 시
  document.getElementById("btnRoutine").onclick = () => {
    currentMode = "routine";
    openModal("매일 할 일"); // 모달 제목을 '매일 할 일'로 표시
  };
};


// 목표에 대한 미리보기 렌더링 함수 (report 페이지)
function renderGoalPreview() {
  const store = getStore();

  // 연간 목표
  const yearPreview = document.getElementById("goalYearPreview");
  yearPreview.innerHTML = "";
  Object.values(store.goals.year).forEach(todos => {
    todos.forEach(t => {
      if(!t.done&&t.text){
      const div = document.createElement("div");
      div.textContent = t.text;
      yearPreview.appendChild(div);
      }
    });
  });

  // 월간 목표
  const monthPreview = document.getElementById("goalMonthPreview");
  monthPreview.innerHTML = "";
  Object.values(store.goals.month).forEach(todos => {
    todos.forEach(t => {
        if(!t.done&&t.text){
      const div = document.createElement("div");
      div.textContent = t.text;
      monthPreview.appendChild(div);
        }
    });
  });

  // 주간 목표
  const weekPreview = document.getElementById("goalWeekPreview");
  weekPreview.innerHTML = "";
  Object.values(store.goals.week).forEach(todos => {
    todos.forEach(t => {
        if(!t.done&&t.text){
      const div = document.createElement("div");
      div.textContent = t.text;
      weekPreview.appendChild(div);
        }
    });
  });
}

// 일정 보여주는 코드
function getFilteredEvents(startStr, endStr) {
  const store = getStore();
  const events = [];
  const viewStart = startStr.split('T')[0];
  const viewEnd = endStr.split('T')[0];

  for (const date in store.todos) {
    if (date >= viewStart && date < viewEnd) {
      const dayTasks = store.todos[date] || [];
      if (dayTasks.length === 0) continue;

      // 💡 [정렬] 시간 일정 우선 -> 그 안에서 시간순 -> 체크리스트 순
      const sortedFullList = [...dayTasks].sort((a, b) => {
        if (a.time && !b.time) return -1;
        if (!a.time && b.time) return 1;
        if (a.time && b.time) return a.time.localeCompare(b.time);
        return 0;
      });

      // 💡 [필터] 캘린더 칸에는 '미완료된 일정'만 바(Bar) 형태로 표시
      const displayTasks = sortedFullList.filter(t => t.time && !t.done);

      displayTasks.forEach(todo => {
        events.push({
          title: todo.text,
          start: `${date}T${todo.time}:00`,
          end: `${date}T${todo.time}:01`,
          allDay: false,
          color: "#3b82f6",
          extendedProps: { 
            // 💡 툴팁에서 사용할 '전체 목록 데이터'를 여기에 담습니다.
            fullData: sortedFullList 
          }
        });
      });
    }
  }
  return events;
}