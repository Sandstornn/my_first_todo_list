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
      aiCache: {},
      settings: { notificationsEnabled: true }
    };
  }

  let parsed = JSON.parse(raw);

  parsed.settings = parsed.settings || {};
parsed.settings.notificationsEnabled =
  parsed.settings.notificationsEnabled ?? true;
parsed.settings.apiKey =
  parsed.settings.apiKey ?? "";
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
/* renderer.js */

async function openReportDetail(title, dateList) {
  const store = getStore();
  const content = document.getElementById("reportDetailContent");
  const backdrop = document.getElementById("reportDetailBackdrop");
  const closeX = document.getElementById("btnReportCloseX");

  // 1. 초기화 및 모달 표시
  document.getElementById("reportDetailTitle").textContent = title;
  content.innerHTML = ""; 
  if (closeX) closeX.onclick = () => backdrop.classList.add("hidden");

  // AI 섹션 생성 (기존 로직 유지)
  const aiSection = document.createElement("div");
  aiSection.className = "ai-summary-container";
  aiSection.innerHTML = `
    <div class="ai-header">🤖 Gemini AI 분석</div>
    <div id="aiSummaryText" class="ai-summary-text">분석 준비 중...</div>
  `;
  content.appendChild(aiSection);

  // --- 🔥 [추가] 상단 목표 섹션 (월간/주간 목표 합쳐서 보여주기) ---
  const upperGoalsContainer = document.createElement("div");
  upperGoalsContainer.className = "report-upper-goals";
  upperGoalsContainer.innerHTML = `<div class="report-day-title">🎯 기간 목표 (월간/주간)</div>`;
  
  let hasUpperGoal = false;
  let allActivities = []; // AI 전달용 데이터 수집

  // 타이틀에서 연, 월, 주 정보 추출
  // title 형식 예: "2026년 3월" 또는 "2026년 3월 · 1주"
  const yearMatch = title.match(/(\d+)년/);
  const monthMatch = title.match(/(\d+)월/);
  const weekMatch = title.match(/(\d+)주/);

  if (yearMatch && monthMatch) {
    const y = yearMatch[1];
    const m = monthMatch[1].padStart(2, '0');
    const monthKey = `${y}-${m}`;
    
    // 1) 월간 목표 수집 및 렌더링
    const mGoals = store.goals.month[monthKey] || [];
    mGoals.forEach(g => {
      hasUpperGoal = true;
      allActivities.push(`[월간목표] ${g.text} (${g.done ? "완료" : "미완료"})`);
      const line = document.createElement("div");
      line.className = `report-item ${g.done ? "done" : "todo"}`;
      line.style.borderLeft = "4px solid #3b82f6"; // 월간 목표 강조색
      line.textContent = `[월간] ${g.done ? "✔" : "✖"} ${g.text}`;
      upperGoalsContainer.appendChild(line);
    });

    // 2) 주간 목표 수집 및 렌더링 (주 정보가 있을 때만)
    if (weekMatch) {
      const w = weekMatch[1];
      const weekKey = `${monthKey}-W${w}`;
      const wGoals = store.goals.week[weekKey] || [];
      wGoals.forEach(g => {
        hasUpperGoal = true;
        allActivities.push(`[주간목표] ${g.text} (${g.done ? "완료" : "미완료"})`);
        const line = document.createElement("div");
        line.className = `report-item ${g.done ? "done" : "todo"}`;
        line.style.borderLeft = "4px solid #10b981"; // 주간 목표 강조색
        line.textContent = `[주간] ${g.done ? "✔" : "✖"} ${g.text}`;
        upperGoalsContainer.appendChild(line);
      });
    }
  }

  if (hasUpperGoal) {
    content.appendChild(upperGoalsContainer);
  }

  // --- 2. 일일 활동 렌더링 ---
  dateList.forEach(date => {
    if (!store.todos[date]) return;
    const dayBlock = document.createElement("div");
    dayBlock.className = "report-day";
    dayBlock.innerHTML = `<div class="report-day-title">${formatDateKorean(date)}</div>`;
    
    store.todos[date].forEach(t => {
      allActivities.push(`[${date}] 할 일: ${t.text} (${t.done ? "완료" : "미완료"})`);
      const line = document.createElement("div");
      line.className = `report-item ${t.done ? "done" : "todo"}`;
      line.textContent = `${t.done ? "✔" : "✖"} ${t.text}`;
      dayBlock.appendChild(line);
    });
    content.appendChild(dayBlock);
  });

  backdrop.classList.remove("hidden");

  // --- 3. 비동기 AI 분석 (기존 로직 유지) ---
  const aiTextEl = aiSection.querySelector("#aiSummaryText");
  const encryptedKey = store.settings?.apiKey || "";

  if (!encryptedKey) {
    aiTextEl.textContent = "Gemini API 키를 설정하면 분석을 시작합니다.";
    return;
  }

  (async () => {
    try {
      const currentDataStr = JSON.stringify(allActivities);
      const cachedEntry = store.aiCache?.[title];
      if (cachedEntry && cachedEntry.data === currentDataStr) {
        aiTextEl.innerText = cachedEntry.summary;
        return;
      }

      aiTextEl.innerText = "데이터 분석 중...";
      const realKey = await window.electronAPI.decryptKey(encryptedKey);
      const summary = await window.electronAPI.getAISummary({ allActivities, apiKey: realKey });

      if (summary) {
        const cleanSummary = summary.replace(/[#*]/g, '').trim();
        aiTextEl.innerText = cleanSummary;
        const updatedStore = getStore();
        updatedStore.aiCache = updatedStore.aiCache || {};
        updatedStore.aiCache[title] = { data: currentDataStr, summary: cleanSummary };
        setStore(updatedStore);
      }
    } catch (err) {
      console.error("AI 분석 중 에러 발생:", err);
    
    // 🔥 [핵심] 429 에러(할당량 초과) 발생 시 사용자 맞춤 메시지 출력
    if (err.message.includes("429") || err.message.includes("quota")) {
      aiTextEl.innerHTML = ` ⚠️ 오늘 사용량을 모두 소진했습니다.\n Gemini API 등급을 업그레이드하거나, 내일 다시 시도해 주세요.`;
    } else {
      // 그 외 일반적인 에러 처리
      aiTextEl.innerText = `⚠️ 분석 실패: ${err.message}`;
      aiTextEl.style.color = "#ef4444";
    }
    }
  })();
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

    // 🔥 [추가] 월간 목표 합산 (m.key는 "YYYY-MM" 형식)
    const monthGoals = store.goals.month[m.key] || [];
    monthGoals.forEach(g => {
      total++;
      if (g.done) done++;
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

      // 🔥 [추가] 주간 목표 수집 (주간 키 형식: "YYYY-MM-Wn")
      const weekKey = `${m.key}-W${week}`;
      const weekGoals = store.goals.week[weekKey] || [];
      weekTodos.push(...weekGoals);

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
    store.todos[selectedDate] = [];
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

  // 알람 코드
  function startAlarmSystem() {
  // 1분마다 체크하는 타이머 시작
  setInterval(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const store = getStore();
    if (!store.settings.notificationsEnabled) return;
    const todayTodos = store.todos[todayStr] || [];

    todayTodos.forEach(todo => {
      // 💡 조건: 시간 설정이 있고, 미완료 상태이며, 아직 알림을 보낸 적 없는 항목
      if (todo.time && !todo.done && !todo.notified) {
        const [h, m] = todo.time.split(":").map(Number);
        const todoTotalMinutes = h * 60 + m;

        // 💡 현재 시간으로부터 정확히 5분 전인지 확인
        if (todoTotalMinutes - currentTotalMinutes === 5) {
          window.electronAPI.sendNotification({
            title: "일정 알림 (5분 전)",
            body: `[${todo.time}] ${todo.text} 일정이 5분 후 있습니다.`
          });

          // 중복 알림 방지를 위해 마킹 후 저장
          todo.notified = true;
          saveTodos(todayStr, todayTodos);
        }
      }
    });
  }, 60000); // 60,000ms = 1분
}
// 토글 스위치 이벤트 연결 (window.onload 내부에 추가)
const alarmToggle = document.getElementById("alarmToggle");
const alarmLabel = document.getElementById("alarmStatusLabel");

alarmToggle.onchange = () => {
  const store = getStore();
  store.settings.notificationsEnabled = alarmToggle.checked;
  setStore(store);
  
  alarmLabel.textContent = alarmToggle.checked ? "알림 on" : "알림 off";
};

// 페이지 로드 시 기존 설정값 반영
const initialStore = getStore();
alarmToggle.checked = initialStore.settings.notificationsEnabled;
alarmLabel.textContent = alarmToggle.checked ? "알림 on" : "알림 off";

// 이거 안쓴듯
renderGoalPreview();

// 시스템 가동!
startAlarmSystem();


};


// 목표에 대한 미리보기 렌더링 함수 (report 페이지)
function renderGoalPreview() {
  const store = getStore();
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  // 해당 월의 1일이 무슨 요일인지 고려하여 계산합니다.
  const firstDayOfMonth = new Date(year, today.getMonth(), 1);
  const week = Math.ceil((today.getDate() + firstDayOfMonth.getDay()) / 7);

  // 1. 현재 기간에 해당하는 키(Key) 생성
  const currentYearKey = String(year);
  const currentMonthKey = `${year}-${month}`;
  const currentWeekKey = `${year}-${month}-W${week}`;

  // --- 연간 목표 (올해 데이터만) ---
  const yearPreview = document.getElementById("goalYearPreview");
  yearPreview.innerHTML = "";
  const yearTodos = store.goals.year[currentYearKey] || [];
  yearTodos.forEach(t => {
    if(!t.done && t.text) {
      const div = document.createElement("div");
      div.textContent = t.text;
      yearPreview.appendChild(div);
    }
  });

  // --- 월간 목표 (이번 달 데이터만) ---
  const monthPreview = document.getElementById("goalMonthPreview");
  monthPreview.innerHTML = "";
  const monthTodos = store.goals.month[currentMonthKey] || [];
  monthTodos.forEach(t => {
    if(!t.done && t.text) {
      const div = document.createElement("div");
      div.textContent = t.text;
      monthPreview.appendChild(div);
    }
  });

  // --- 주간 목표 (이번 주 데이터만) ---
  const weekPreview = document.getElementById("goalWeekPreview");
  if (weekPreview) {
    weekPreview.innerHTML = "";
    const weekTodos = store.goals.week[currentWeekKey] || [];
    weekTodos.forEach(t => {
      if(!t.done && t.text) {
        const div = document.createElement("div");
        div.textContent = t.text;
        weekPreview.appendChild(div);
      }
    });
  }
}
/* gemini key modal 코드 */


/* renderer.js - 기존의 모든 Gemini 모달 관련 코드를 지우고 이 '재렌더링' 방식으로 교체하세요 */
/* renderer.js - 이 블록 하나만 Gemini 관련 최종 코드로 사용하세요 */

const GeminiUI = {
  // 💡 1. HTML을 아예 새로 구워버리는 함수 (페이지 이동 효과와 동일)
  refresh: function() {
    const store = getStore();
    const hasKey = !!(store.settings && store.settings.apiKey);
    const backdrop = document.getElementById("keyModalBackdrop");

    if (!backdrop) return;

    // 껍데기 내부를 완전히 비우고 새로 작성 (상태값 강제 소멸)
    backdrop.innerHTML = `
      <div class="modal" style="width: 360px;">
        <div class="modal-header">
          <div>
            <div class="modal-title">Gemini API 설정</div>
            <div class="modal-sub">AI 분석용 API 키 관리</div>
          </div>
          <button class="icon-btn" id="btnKeyModalCloseX">✕</button>
        </div>
        <div class="modal-body">
          <input type="password" id="apiKeyInput" class="todo-input" 
                 placeholder="${hasKey ? '새 키 입력 시 기존 키 교체' : 'API Key를 입력하세요'}" 
                 style="width: 100%; margin-bottom: 12px;" autocomplete="off">
          <div id="keyStatusText" style="font-size: 11px; color: ${hasKey ? '#059669' : '#64748b'}; margin-bottom: 16px;">
            ${hasKey ? '✅ 키가 등록되어 있습니다.' : '⚠️ 저장된 키가 없습니다.'}
          </div>
          <div class="modal-footer" style="padding-top: 0;">
            ${hasKey ? '<button class="btn btn-danger" id="btnGeminiDeleteKey">키 삭제</button>' : ''}
            <button class="btn" id="btnSaveKey">저장하기</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  },

  // 💡 2. 새로 만들어진 버튼들에 기능 연결
  bindEvents: function() {
    const backdrop = document.getElementById("keyModalBackdrop");
    const input = document.getElementById("apiKeyInput");
    const saveBtn = document.getElementById("btnSaveKey");
    const deleteBtn = document.getElementById("btnGeminiDeleteKey");
    const closeX = document.getElementById("btnKeyModalCloseX");

    closeX.onclick = () => backdrop.classList.add("hidden");

    saveBtn.onclick = async () => {
      const val = input.value.trim();
      if (!val) return alert("키를 입력하세요.");
      const encrypted = await window.electronAPI.encryptKey(val);
      const store = getStore();
      store.settings.apiKey = encrypted;
      setStore(store);
      // 이거때문에 input 초기화 안돼서 또 2시간 날렸다. 진짜 조심하자. input뒤에 alert쓰지 말기
      // alert("성공적으로 저장되었습니다.");
      // alert가 기본 모달이라 focus를 뺏어가서 그렇다네. 진짜 개빡치네
      input.value = "";   
      // backdrop.classList.add("hidden");

      // 💡 삭제 즉시 페이지를 새로고침하듯 다시 렌더링
        this.refresh(); 
        document.getElementById("apiKeyInput").focus();
    };

    if (deleteBtn) {
      deleteBtn.onclick = async () => {
        if (!(await openConfirm("저장된 API 키를 삭제할까요?"))) return;
        const store = getStore();
        store.settings.apiKey = "";
        setStore(store);
        
        // 💡 삭제 즉시 페이지를 새로고침하듯 다시 렌더링
        this.refresh(); 
        document.getElementById("apiKeyInput").focus();
      };
    }
  }
};

// 💡 3. 모달 열기 버튼 (기존 핸들러를 완전히 대체)
document.getElementById("btnOpenKeyModal").onclick = (e) => {
  e.preventDefault();
  // 🚀 열 때마다 무조건 새로 굽기 (이게 페이지 들렀다 오는 효과를 냅니다)
  GeminiUI.refresh(); 
  document.getElementById("keyModalBackdrop").classList.remove("hidden");
  
  // 찰나의 시간 뒤에 포커스 (브라우저 버그 방지)
  setTimeout(() => {
    const input = document.getElementById("apiKeyInput");
    if(input) input.focus();
  }, 50);
};

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