// 알림과 소리: "확인 필요" 차임 + 데스크톱 알림 + 화면 테두리 깜빡임, 그리고 은은한 타자 소리
// 소리는 파일 없이 Web Audio 로 직접 만든다. 브라우저 정책상 버튼을 한 번 눌러야 소리가 켜진다.
const pref = (k: string, def: boolean) => { try { const v = localStorage.getItem("office." + k); return v == null ? def : v === "1"; } catch { return def; } };
const setPref = (k: string, v: boolean) => { try { localStorage.setItem("office." + k, v ? "1" : "0"); } catch { /* */ } };

export const settings = {
  get alerts() { return pref("alerts", true); }, set alerts(v: boolean) { setPref("alerts", v); },
  get typing() { return pref("typing", false); }, set typing(v: boolean) { setPref("typing", v); },
  get log() { return pref("log", true); }, set log(v: boolean) { setPref("log", v); },
  get nature() { return pref("nature", false); }, set nature(v: boolean) { setPref("nature", v); },
};

let ac: AudioContext | null = null;
export function audio() {
  if (!ac) { try { ac = new AudioContext(); } catch { return null; } }
  if (ac.state === "suspended") ac.resume().catch(() => { /* */ });
  return ac;
}

/** 딩-동 두 음 */
export function chime() {
  const a = audio(); if (!a || a.state !== "running") return;
  const t = a.currentTime;
  [[880, 0], [1318.5, 0.16]].forEach(([f, d]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.18, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
    o.connect(g).connect(a.destination); o.start(t + d); o.stop(t + d + 0.65);
  });
}
/** 완료: 짧고 밝은 세 음 */
export function done() {
  const a = audio(); if (!a || a.state !== "running") return;
  const t = a.currentTime;
  [523.3, 659.3, 784].forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.09); g.gain.linearRampToValueAtTime(0.07, t + i * 0.09 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.3);
    o.connect(g).connect(a.destination); o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.35);
  });
}

export async function enableDesktop() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}
export function notify(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || document.hasFocus()) return;
  try { new Notification(title, { body, silent: true, tag: "claude-office-" + title }); } catch { /* */ }
}

/** 기다리는 세션이 있으면 테두리가 노랗게 숨 쉬고, 새로 생긴 순간엔 한 번 크게 번쩍 */
export function flash(waiting: number, fresh: boolean) {
  const s = document.getElementById("stage");
  if (!s) return;
  s.classList.toggle("waiting", waiting > 0);
  if (fresh) { s.classList.remove("hit"); void s.offsetWidth; s.classList.add("hit"); }
}

// ── 타자 소리: 일하는 세션 수만큼 바빠진다 ──
let level = 0, timer: number | null = null;
function click() {
  const a = audio(); if (!a || a.state !== "running") return;
  const len = 0.025, buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
  bp.type = "bandpass"; bp.frequency.value = 1800 + Math.random() * 1600; bp.Q.value = 1.2;
  g.gain.value = 0.05 + Math.random() * 0.03;
  src.buffer = buf; src.connect(bp).connect(g).connect(a.destination); src.start();
}
function loop() {
  if (!settings.typing || level <= 0) { timer = window.setTimeout(loop, 600); return; }
  click();
  const gap = 90 + Math.random() * 220;                       // 한 사람의 타자 간격
  const pause = Math.random() < 0.08 ? 400 + Math.random() * 900 : 0;   // 가끔 멈칫
  timer = window.setTimeout(loop, (gap + pause) / Math.min(level, 4));
}
export function setTypingLevel(n: number) { level = n; if (timer == null) loop(); }
