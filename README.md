# My First To-Do List
캘린더 기반의 간단한 To-Do List 데스크톱 앱입니다.  
Electron을 사용해 웹 기술로 데스크톱 애플리케이션을 구현했습니다.

## Features
- 캘린더 기반 일정 관리
- 날짜별 To-Do 추가 / 삭제
- localStorage에서 데이터 관리
- 데스크톱 앱(Electron) 형태로 실행 가능
- Gemini AI 분석: 주간/월간 활동을 분석하여 목표 대비 실행력을 리포트해주는 기능
- 매일 할 일(Routine): 매일 자동으로 추가되는 루틴 관리 기능
- Sub-tasks: 각 체크리스트 아래에 세부 항목을 추가하고 관리하는 기능
- 이원화 대시보드: 캘린더 페이지 아래에 배치된 리포트 페이지를 통해 진행률을 히트맵 형태로 확인 가능


## Tech Stack
- Electron
- HTML / CSS / JavaScript
- FullCalendar v5.11.5(v6부터는 css 임의설정 힘듦)
- Gemini API (gemini-2.5-flash-lite): 주간/월간 체크리스트 요약/분석에 사용
- dotenv: API 키 보안 관리를 위해 사용

## Project Structure
```text
my_first_todo_list/
├─ index.html          # 메인 UI 구조 및 모달 정의
├─ main.js            # Electron 메인 프로세스 (Gemini API 통신 및 창 관리)
├─ renderer.js        # 렌더러 프로세스 (루틴 자동 추가, AI 캐싱, 데이터 정렬 로직)
├─ pre_load.js        # 메인-렌더러 프로세스 간 IPC 통신 브릿지
├─ style.css          # 앱 전체 스타일링 (색연필 효과 및 대시보드 레이아웃)
├─ .env               # API Key 등 보안이 필요한 환경 변수 관리
├─ .gitignore         # Git 추적 제외 목록 (.env, node_modules 등)
├─ icon.ico           # 빌드 시 사용되는 애플리케이션 아이콘
├─ package.json       # 프로젝트 의존성(Gemini SDK, dotenv 등) 및 빌드 설정
├─ package-lock.json  # 설치된 패키지의 정확한 버전 잠금 파일
├─ vendor/            # 외부 라이브러리 자산
│  └─ fullcalendar-5.11.5/
│     ├─ main.min.js
│     ├─ main.min.css
│     ├─ locales-all.min.js
│     └─ LICENSE.txt
└─ README.md          # 프로젝트 설명 및 확장된 데이터 저장 구조 정의
```

## 데이터 저장 구조 (Data Structure)

본 애플리케이션은 사용자의 할 일 데이터를 `localStorage`의 `todos` 키에 JSON 객체 형태로 저장합니다.

### Schema

```json
{
  "todos": {
    "2026-02-26": [
      { "text": "할 일 제목", "done": false, "subs": [{ "text": "세부 항목", "done": false }] }
    ]
  },
  "goals": {
    "year": { "2026": [] },
    "month": { "2026-02": [] },
    "week": { "2026-02-W4": [] }
  },
  "routines": [
    { "text": "매일 할 일 루틴", "done": false, "subs": [] }
  ],
  "lastRoutineDate": "2026-02-26",
  "aiCache": {
    "리포트 제목 (예: 2026년 2월)": {
      "data": "분석에 사용된 활동 데이터 문자열",
      "summary": "AI 분석 결과 텍스트"
    }
  }
}
```

## How to Run (Development)
```bash
npm install
npm start
``` 

##  Build (exe)
```bash
npm run build
``` 

## Planned features
- 각 항목들 위치 옮기기(html5 draggable or sortable.js 라이브러리 사용)
- 캘린더 기능 구현(알람, 시간 기반 일정 관리 등등)
- 연/월 선택 순환 로직(23년 12월에서 월을 밑으로 당기면 24년 1월이 되도록)