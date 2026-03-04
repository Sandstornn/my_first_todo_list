# My First To-Do List
캘린더 기반의 간단한 To-Do List 데스크톱 앱입니다.  
Electron을 사용해 웹 기술로 데스크톱 애플리케이션을 구현했습니다.

## Features
- 캘린더 기반 일정 관리 (FullCalendar v5 활용)
- 날짜별 To-Do 추가 / 삭제 및 세부 항목(Sub-tasks) 관리
- localStorage 데이터 관리 및 JSON 파일 내보내기/가져오기(Export/Import) 기능
- 데스크톱 앱(Electron) 형태로 실행 가능
- **Gemini AI 분석**: `gemini-2.5-flash-lite`를 사용하여 활동 데이터를 요약/분석 리포트 제공
- **보안 강화**: `safeStorage`를 사용해 사용자의 Gemini API 키를 로컬에 암호화하여 저장
- **최적화 및 대응**: 지능형 AI 캐싱으로 호출 횟수 절약 및 할당량 초과(429) 시 사용자 안내
- 매일 할 일(Routine): 매일 자동으로 추가되는 루틴 관리 기능
- 이원화 대시보드: 캘린더 페이지 아래 배치된 리포트 페이지와 히트맵 진행률 확인

## Tech Stack
- Electron
- HTML / CSS / JavaScript
- FullCalendar v5.11.5 (v6부터는 css 임의설정 힘듦)
- Gemini API (gemini-2.5-flash-lite): 주간/월간 체크리스트 요약/분석에 사용
- dotenv: API 키 보안 관리를 위해 사용
- safeStorage: 사용자 API 키의 암호화 보관을 위해 사용

## Project Structure
```text
my_first_todo_list/
├─ index.html         # 메인 UI 구조 및 모달 정의
├─ main.js            # Electron 메인 프로세스 (Gemini API 통신, 암호화 및 창 관리)
├─ renderer.js        # 렌더러 프로세스 (루틴 처리, AI 캐싱, 데이터 Export/Import 로직)
├─ pre_load.js        # 메인-렌더러 프로세스 간 IPC 통신 브릿지
├─ style.css          # 앱 전체 스타일링 (색연필 효과 및 대시보드 레이아웃)
├─ .env               # 환경 변수 관리 (배포 시 제외)
├─ .gitignore         # Git 추적 제외 목록
├─ icon.ico           # 빌드 시 사용되는 애플리케이션 아이콘
├─ package.json       # 프로젝트 의존성 및 nsis 빌드 설정
├─ package-lock.json  # 패키지 버전 잠금 파일
├─ vendor/            # 외부 라이브러리 자산
│  └─ fullcalendar-5.11.5/
└─ README.md          # 프로젝트 설명 및 데이터 구조 정의
```

## 데이터 저장 구조 (Data Structure)

본 애플리케이션은 사용자의 할 일 데이터를 `localStorage`의 `todos` 키에 JSON 객체 형태로 저장하며, API 키는 보안 저장소에 별도로 관리됩니다.

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
- 제미나이 프롬프트를 사용자가 직접 설정할 수 있도록 업데이트 예정입니다.
- local LLM 통합 검토: 개인정보 보호 강화 및 오프라인 분석을 위해 로컬 LLM 연동을 검토 중입니다.