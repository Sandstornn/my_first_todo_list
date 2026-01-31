let selectedDate = null;
let confirmResolve = null;
let openedTodoIndex = null;

/* ---------- util ---------- */
function getStore() {
  return JSON.parse(localStorage.getItem("todos") || "{}");
}
function setStore(data) {
  localStorage.setItem("todos", JSON.stringify(data));
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

  document.getElementById("modalTitle").textContent = dateStr;
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
}

/* ---------- todos ---------- */
function loadTodos(date) {
  const list = document.getElementById("todoList");
  list.innerHTML = "";

  const store = getStore();
  const todos = store[date] || [];

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

    const del = document.createElement("button");
    del.className = "todo-del";
    del.textContent = "✕";
    del.onclick = e => {
      e.stopPropagation();
      todos.splice(idx, 1);
      saveTodos(date, todos);
      loadTodos(date);
    };

    item.append(check, text, del);
    list.appendChild(item);

    /* ---------- 🔥 sub를 "바로 아래"에 끼워 넣기 ---------- */
    if (openedTodoIndex === idx) {
      const subWrap = document.createElement("div");
      subWrap.className = "todo-sub-wrap";

      (todo.subs || []).forEach((sub, sIdx) => {
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
  store[date] = todos;
  setStore(store);
}

/* ---------- events ---------- */
window.onload = () => {
  const calendar = new FullCalendar.Calendar(
    document.getElementById("calendar"),
    {
      initialView: "dayGridMonth",
      locale: "ko",
      height: "auto",
      headerToolbar: false,
      dateClick(info) {
        openModal(info.dateStr);
      }
    }
  );
  calendar.render();

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

  /* 월 선택 scroll picker*/
  let pickerYear;
  let pickerMonth;
  function openYmPicker() {
  const backdrop = document.getElementById("ymBackdrop");
  const yearList = document.getElementById("yearList");
  const monthList = document.getElementById("monthList");

  yearList.innerHTML = "";
  monthList.innerHTML = "";

  pickerYear = currentDate.getFullYear();
  pickerMonth = currentDate.getMonth(); // 0-based

  /* 스크롤 할 떄 선택 항목이 항상 중앙으로 오게 해주는 함수 */
  function scrollItemToCenter(container, item) {
  const cRect = container.getBoundingClientRect();
  const iRect = item.getBoundingClientRect();

  const scrollTop = (iRect.top + iRect.height / 2) - (cRect.top + cRect.height / 2);

  container.scrollBy({
    top: scrollTop,
    behavior: "smooth"
  });

  
}

  // 연도 (현재 기준 ±5년)
  for (let y = pickerYear - 5; y <= pickerYear + 5; y++) {
    const el = document.createElement("div");
    el.className = "ym-item" + (y === pickerYear ? " active" : "");
    el.textContent = `${y}년`;
    el.onclick = () => {
      pickerYear = y;
      document.querySelectorAll("#yearList .ym-item")
        .forEach(i => i.classList.remove("active"));
      el.classList.add("active");
      scrollItemToCenter(yearList, el); // ✅ 추가
    };
    yearList.appendChild(el);
  }

  // 월
  for (let m = 0; m < 12; m++) {
    const el = document.createElement("div");
    el.className = "ym-item" + (m === pickerMonth ? " active" : "");
    el.textContent = `${m + 1}월`;
    el.onclick = () => {
      pickerMonth = m;
      document.querySelectorAll("#monthList .ym-item")
        .forEach(i => i.classList.remove("active"));
      el.classList.add("active");

      /*여기도 선택 항목 중앙정렬 추가*/
      scrollItemToCenter(monthList, el);
    };
    monthList.appendChild(el);
  }

  // 일단 보이게 하기
  backdrop.classList.remove("hidden");

  // 그 다음 프레임에 중앙 정렬
  requestAnimationFrame(() => {
    const yActive = yearList.querySelector(".ym-item.active");
    const mActive = monthList.querySelector(".ym-item.active");
    if (yActive) scrollItemToCenter(yearList, yActive);
    if (mActive) scrollItemToCenter(monthList, mActive);
  });

}
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
    const todos = store[selectedDate] || [];

    todos.push({ text: input.value, done: false, subs: [] });
    saveTodos(selectedDate, todos);

    input.value = "";
    loadTodos(selectedDate);
    input.focus();
  };

  document.getElementById("btnClearDone").onclick = () => {
    if (!selectedDate) return;

    const store = getStore();
    store[selectedDate] = (store[selectedDate] || []).filter(t => !t.done);
    setStore(store);
    loadTodos(selectedDate);
  };

  document.getElementById("btnDeleteDay").onclick = async () => {
    if (!selectedDate) return;

    const ok = await openConfirm("이 날짜의 모든 할 일을 삭제할까요?",{no_danger:true});
    if (!ok) return;

    const store = getStore();
    delete store[selectedDate];
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
};
