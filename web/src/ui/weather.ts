// 진짜 날씨: 서버(collectors/weather.js)가 Open-Meteo 에서 10분마다 읽어 둔 걸 5분마다 가져온다.
// 오른쪽 위 날씨 칩에 보여 주고, 바깥 풍경(비·눈·안개·흐림)·창문·햇살·밖에 있는 직원 우산에 반영된다.
// 미리보기: 주소 뒤에 ?weather=rain  (clear·cloudy·fog·drizzle·rain·snow·storm, 끝에 숫자 1~3 을 붙이면 세기: rain3)
import { esc, ago } from "./bubble";
import { thunder } from "./nature";

export type WeatherKind = "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";
export interface Weather {
  kind: WeatherKind; level: number; label: string; name: string;
  temp: number | null; precip: number; cloud: number | null; wind: number | null; fetchedAt: number; preview?: boolean;
}

let cur: Weather | null = null;
/** 지금 날씨 (모르면 null — 그땐 계절 풍경만) */
export const weatherNow = () => cur;
/** 비·눈이 내리는 중 (밖에 있는 직원은 우산을 씀) */
export const isWet = (w: Weather | null = cur) => !!w && (w.kind === "drizzle" || w.kind === "rain" || w.kind === "storm" || w.kind === "snow");

const ICON = (w: Weather) => ({ clear: w.level ? "🌤️" : "☀️", cloudy: w.level > 1 ? "☁️" : "⛅", fog: "🌫️", drizzle: "🌦️", rain: "🌧️", snow: "🌨️", storm: "⛈️" })[w.kind];
const KINDS: WeatherKind[] = ["clear", "cloudy", "fog", "drizzle", "rain", "snow", "storm"];
const LABEL: Record<WeatherKind, string> = { clear: "맑음", cloudy: "흐림", fog: "안개", drizzle: "이슬비", rain: "비", snow: "눈", storm: "뇌우" };

function preview(): Weather | null {
  let q: string | null = null;
  try { q = new URLSearchParams(location.search).get("weather"); } catch { /* */ }
  const m = q?.match(/^([a-z]+)([123])?$/);
  if (!m || !KINDS.includes(m[1] as WeatherKind)) return null;
  const kind = m[1] as WeatherKind, level = m[2] ? Number(m[2]) : kind === "clear" ? 0 : kind === "storm" ? 3 : kind === "drizzle" ? 1 : 2;
  return { kind, level, label: `${LABEL[kind]} (미리보기)`, name: "미리보기", temp: kind === "snow" ? -2 : 12, precip: 0, cloud: null, wind: 3, fetchedAt: Date.now(), preview: true };
}

function render() {
  const el = document.getElementById("weather");
  if (!el) return;
  if (!cur) { el.hidden = true; return; }
  const w = cur, t = w.temp != null ? `${Math.round(w.temp)}°` : "";
  el.hidden = false;
  el.innerHTML = `<span class="wi">${ICON(w)}</span>${t ? `<b>${t}</b>` : ""}<span>${esc(w.label.replace(" (미리보기)", ""))}</span>`;
  el.title = [w.name, w.label, w.temp != null ? `${w.temp}°C` : "", w.precip ? `강수 ${w.precip}mm` : "", w.wind != null ? `바람 ${w.wind}m/s` : "",
    w.cloud != null ? `구름 ${w.cloud}%` : "", w.preview ? "" : `${ago(w.fetchedAt)} 갱신`, "날씨 데이터: Open-Meteo.com"].filter(Boolean).join(" · ");
}

async function load() {
  try {
    const r = await fetch("/api/weather");
    if (!r.ok) { cur = null; render(); return; }   // 날씨 부서가 꺼져 있음 (config.json 에 위치 없음)
    const j = await r.json();
    cur = j.status === "ok" ? { kind: j.kind, level: j.level, label: j.label, name: j.name, temp: j.temp, precip: j.precip || 0, cloud: j.cloud, wind: j.wind, fetchedAt: j.fetchedAt } : null;
  } catch { /* 서버 잠깐 꺼짐: 마지막 날씨 유지 */ }
  render();
}

export function startWeather() {
  cur = preview();
  if (cur) { render(); return; }
  load();
  setInterval(load, 5 * 60000);
}

/** 번개: 화면이 두 번 번쩍 (뇌우일 때만, 은은하게) */
export function lightning() {
  const el = document.getElementById("lightning");
  if (!el) return;
  el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
  thunder();
}
