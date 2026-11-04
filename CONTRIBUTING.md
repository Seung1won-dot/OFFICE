# 기여하기

이슈와 PR 환영해요. 올리기 전에 `npm run check-secrets` 로 토큰·개인 경로가 섞이지 않았는지 확인해 주세요.

## 개발 환경

```bash
npm run build      # 처음 한 번 (web 의존성 설치 + 빌드)
npm start          # API 서버 (4747)
npm run dev        # 화면 개발 서버 (5173, 핫 리로드, /api 는 4747 로 프록시)
cd web && npx tsc --noEmit   # 타입 검사
```

## 새 부서(collector) 만들기

부서 하나 = `collectors/` 아래 파일 하나예요. 예를 들어 "캘린더팀"을 추가한다면:

### 1. `collectors/calendar.js`

```js
// 캘린더팀 collector: 오늘 일정 수를 보여준다
const { expandHome } = require("../lib/config");
let state = { status: "loading", today: 0 };
let timer = null;

module.exports = {
  name: "calendar",                 // config.json collectors 의 키, API 경로에도 씀
  title: "캘린더팀",                 // 화면에 보일 이름

  // 켜도 되는지 검사. 토큰·경로가 없으면 { ok: false, reason } → 이 부서만 "부재중"
  check(ctx) {
    return process.env.CALENDAR_TOKEN ? { ok: true } : { ok: false, reason: "CALENDAR_TOKEN 없음" };
  },

  // 폴링 시작. ctx.config() 는 매번 최신 config.json
  start(ctx) {
    const poll = async () => { /* ... 읽기만 하는 조회 ... */ state = { status: "ok", today: 3 }; };
    poll();
    timer = setInterval(poll, (ctx.config().calendarPollSec || 120) * 1000);
  },
  stop() { clearInterval(timer); },

  // "메서드 경로" → 핸들러. ctx.send(res, code, obj), ctx.readBody(req)
  routes: {
    "GET /api/calendar": (req, res, ctx) => ctx.send(res, 200, state),
  },
};
```

### 2. 등록

`collectors/index.js` 의 `LIST` 에 `"calendar"` 추가, `config.example.json` 의 `collectors` 에 `"calendar": false` 추가,
토큰이 필요하면 `.env.example` 에 빈 값으로 추가.

### 3. 화면에 보여주기

- 부서 연결 상태 줄(`#collectors`)에는 자동으로 나와요.
- 맵에 구역을 만들려면 `web/src/map/defaultMap.ts` 에서 `room("calendar", "캘린더팀", …)` 과 POI(`calendar_desk_1` 처럼 `<종류>_<번호>`)를 추가하고,
  `web/src/scenes/OfficeScene.ts` 의 `ZONE_POI` / `ZONE_NAME` 에 연결하세요.
- 세션이 특정 도구를 쓸 때 그 부서로 "출장" 가게 하려면 `config.json` 의 `tripKeywords` 에 `"calendar": "<구역 키>"` 를 넣으면 돼요 (코드 수정 불필요).

### collector 규칙

- **읽기만** 하기. 외부 서비스에 쓰기·수정 요청을 보내지 않기.
- 토큰은 `process.env` 에서만 읽고, 응답(`routes`)에 토큰·절대 경로·본문 내용을 넣지 않기. 화면에 필요한 숫자·상태 위주로.
- 실패해도 서버가 죽지 않게 `try/catch` 하고 `state.status = "error"` 로 표시.
- 새 의존성 없이 Node 내장 모듈(`https`, `fs`)로 충분하면 그렇게.

## 그림 바꾸기

- 타일: `web/src/gfx/tileset.ts` 의 `DRAW` (16px, 팔레트는 같은 파일의 `P`). 가구에는 자동으로 외곽선이 그려져요.
- 캐릭터: `web/src/gfx/people.ts` (몸/옷/머리/액세서리 레이어, 16×24 프레임).
- 외부 에셋을 넣을 땐 라이선스를 확인하고 `CREDITS.md` 에 출처를 적어 주세요. 재배포 불가 에셋은 저장소에 올리지 말고 `assets/third-party/` 방식으로.
