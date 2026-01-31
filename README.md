# My First To-Do List
캘린더 기반의 간단한 To-Do List 데스크톱 앱입니다.  
Electron을 사용해 웹 기술로 데스크톱 애플리케이션을 구현했습니다.

## Features
- 캘린더 기반 일정 관리
- 날짜별 To-Do 추가 / 삭제
- localStorage에서 데이터 관리
- 데스크톱 앱(Electron) 형태로 실행 가능

## Tech Stack
- Electron
- HTML / CSS / JavaScript
- FullCalendar

## Project Structure
my_first_todo_list/
├─ index.html
├─ main.js
├─ renderer.js
├─ pre_load.js
├─ style.css
├─ package.json
├─ vendor/
│ └─ fullcalendar-5.11.5/
│    └─ main.min.js
│    └─ main.min.css
│    └─ locales-all.min.js
│    └─ LICENSE.txt
└─ README.md

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
- 캘린더 하단에 추가 페이지를 배치하여 스크롤 방식의 UI 구성
- 1년 단위의 월별 / 주별 진행률을 시각적으로 제공
- 특정 주를 클릭하면 해당 주의 세부 To-Do checklist 및 요약 정보 표시
