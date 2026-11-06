// 날씨 collector: config.json 의 weather 위치(동네 단위 위도·경도)의 지금 날씨를 Open-Meteo 에서 10분마다 읽어 온다.
// API 키가 필요 없고, 밖으로 보내는 건 그 좌표뿐이다. 날씨 데이터: Open-Meteo.com (CC BY 4.0)
//   "weather": { "name": "우리 동네", "lat": 37.57, "lon": 126.98 }
const https = require("https");

let state = { status: "loading", fetchedAt: 0 };
let timer = null;

/** WMO 날씨 코드 → 화면에서 쓰는 종류 · 세기(1~3) · 이름 */
function kindOf(code) {
  if (code == null) return null;
  if (code === 0) return { kind: "clear", level: 0, label: "맑음" };
  if (code === 1) return { kind: "clear", level: 1, label: "대체로 맑음" };
  if (code === 2) return { kind: "cloudy", level: 1, label: "구름 조금" };
  if (code === 3) return { kind: "cloudy", level: 2, label: "흐림" };
  if (code === 45 || code === 48) return { kind: "fog", level: 2, label: "안개" };
  if (code >= 51 && code <= 57) return { kind: "drizzle", level: [51, 56].includes(code) ? 1 : [55, 57].includes(code) ? 3 : 2, label: code >= 56 ? "어는 이슬비" : "이슬비" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const level = [61, 66, 80].includes(code) ? 1 : [65, 67, 82].includes(code) ? 3 : 2;
    return { kind: "rain", level, label: code >= 80 ? "소나기" : code >= 66 ? "어는 비" : level === 3 ? "강한 비" : level === 1 ? "약한 비" : "비" };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    const level = [71, 77, 85].includes(code) ? 1 : [75, 86].includes(code) ? 3 : 2;
    return { kind: "snow", level, label: code === 77 ? "싸락눈" : level === 3 ? "함박눈" : level === 1 ? "약한 눈" : "눈" };
  }
  if (code >= 95) return { kind: "storm", level: 3, label: code === 95 ? "뇌우" : "우박 동반 뇌우" };
  return { kind: "cloudy", level: 1, label: "흐림" };
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "user-agent": "claude-office" } }, (res) => {
      let d = ""; res.on("data", c => d += c);
      res.on("end", () => { if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`)); try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on("error", reject); req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

async function poll(ctx) {
  const w = ctx.config().weather || {};
  const q = new URLSearchParams({
    latitude: String(w.lat), longitude: String(w.lon), timezone: "auto", wind_speed_unit: "ms",
    current: "temperature_2m,weather_code,precipitation,rain,showers,snowfall,cloud_cover,wind_speed_10m,is_day",
  });
  try {
    const j = await getJson(`https://api.open-meteo.com/v1/forecast?${q}`);
    const c = j.current || {};
    let k = kindOf(c.weather_code);
    if (!k) throw new Error("날씨 코드 없음");
    // 코드가 맑음·흐림이어도 지난 15분 동안 실제로 내린 게 있으면 비·눈으로
    const precip = Number(c.precipitation) || 0, snow = Number(c.snowfall) || 0;
    if (precip > 0.05 && !["drizzle", "rain", "snow", "storm"].includes(k.kind))
      k = snow > 0 ? { kind: "snow", level: 1, label: "약한 눈" } : { kind: "rain", level: 1, label: "약한 비" };
    state = {
      status: "ok", name: w.name || "", ...k, code: c.weather_code,
      temp: c.temperature_2m ?? null, precip, snowfall: snow, cloud: c.cloud_cover ?? null, wind: c.wind_speed_10m ?? null,
      observedAt: c.time || null, fetchedAt: Date.now(),
    };
  } catch (e) {
    // 잠깐 실패하면 마지막 날씨를 2시간까지는 그대로 보여 줌
    const old = state.status === "ok" && Date.now() - state.fetchedAt < 2 * 3600e3;
    state = old ? { ...state, error: String(e.message).slice(0, 120) } : { status: "error", error: String(e.message).slice(0, 120), fetchedAt: Date.now() };
  }
}

module.exports = {
  name: "weather",
  title: "날씨",
  check(ctx) {
    const w = ctx.config().weather;
    return w && typeof w.lat === "number" && typeof w.lon === "number" ? { ok: true } : { ok: false, reason: "config.json 의 weather 에 위치(lat·lon)를 넣으면 켜져요" };
  },
  start(ctx) {
    poll(ctx);
    timer = setInterval(() => poll(ctx), Math.max(5, Number(ctx.config().weather?.pollMin) || 10) * 60000);
  },
  stop() { clearInterval(timer); },
  routes: { "GET /api/weather": (req, res, ctx) => ctx.send(res, 200, state) },
};
