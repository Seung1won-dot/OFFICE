// 자연 소리 (기본 꺼짐, 오른쪽 위 🌿 버튼): 진짜 날씨에 맞춰 아주 작게.
// 비 = 걸러 낸 잡음(세기에 따라 크게) · 맑은 낮 = 가끔 새 지저귐 · 뇌우 = 번개 뒤 낮은 천둥. 파일 없이 Web Audio 로 만든다.
import { audio, settings } from "./alerts";
import { weatherNow } from "./weather";

let rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null, nextChirp = 0;

function noise(a: AudioContext, sec: number) {
  const b = a.createBuffer(1, Math.floor(a.sampleRate * sec), a.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 + (Math.random() * 2 - 1) * 0.35; }   // 갈색+흰 잡음
  return b;
}
function setRain(level: number) {
  const a = audio(); if (!a || a.state !== "running") return;
  if (!rain) {
    const src = a.createBufferSource(); src.buffer = noise(a, 3); src.loop = true;
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
    const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 300;
    const gain = a.createGain(); gain.gain.value = 0;
    src.connect(hp).connect(lp).connect(gain).connect(a.destination); src.start();
    rain = { src, gain };
  }
  rain.gain.gain.setTargetAtTime(level, a.currentTime, 1.5);   // 천천히 커지고 작아짐
}
function chirp() {
  const a = audio(); if (!a || a.state !== "running") return;
  const t = a.currentTime, n = 2 + Math.floor(Math.random() * 3), base = 2600 + Math.random() * 1400;
  for (let i = 0; i < n; i++) {
    const o = a.createOscillator(), g = a.createGain(), s = t + i * 0.13;
    o.type = "sine"; o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.3), s + 0.07);
    g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.025, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.09);
    o.connect(g).connect(a.destination); o.start(s); o.stop(s + 0.1);
  }
}
/** 번개 뒤 천둥 (뇌우일 때 weather.lightning 이 부름) */
export function thunder() {
  if (!settings.nature) return;
  const a = audio(); if (!a || a.state !== "running") return;
  const src = a.createBufferSource(); src.buffer = noise(a, 3);
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 180;
  const g = a.createGain(), t = a.currentTime + 0.6 + Math.random() * 0.8;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 0.15); g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
  src.connect(lp).connect(g).connect(a.destination); src.start(t); src.stop(t + 2.8);
}

export function startNature() {
  setInterval(() => {
    const w = weatherNow(), on = settings.nature;
    const wet = w && (w.kind === "rain" || w.kind === "drizzle" || w.kind === "storm") ? (w.kind === "drizzle" ? 0.02 : w.kind === "storm" ? 0.07 : 0.025 + 0.012 * w.level) : 0;
    if (rain || (on && wet)) setRain(on ? wet : 0);
    const h = new Date().getHours();
    if (on && !wet && w?.kind !== "snow" && h >= 6 && h < 19 && Date.now() > nextChirp) { nextChirp = Date.now() + 4000 + Math.random() * 9000; if (Math.random() < 0.7) chirp(); }
  }, 1000);
}
