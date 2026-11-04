// 캐릭터·방에 커서를 올리면 머리 위에 뜨는 말풍선 (HTML 오버레이라 글씨가 선명)
import Phaser from "phaser";

let el: HTMLDivElement | null = null;
let follow: { scene: Phaser.Scene; pos: () => { x: number; y: number } } | null = null;

function ensure() {
  if (el) return el;
  el = document.createElement("div");
  el.id = "bubble";
  document.getElementById("stage")!.appendChild(el);
  return el;
}

export function showBubble(scene: Phaser.Scene, pos: () => { x: number; y: number }, html: string) {
  const b = ensure();
  if (b.innerHTML !== html) b.innerHTML = html;
  b.style.display = "block";
  follow = { scene, pos };
  placeBubble();
}
export function hideBubble(scene?: Phaser.Scene) {
  if (scene && follow && follow.scene !== scene) return;
  follow = null;
  if (el) el.style.display = "none";
}
/** 매 프레임 호출: 걷는 캐릭터를 따라감 */
export function placeBubble() {
  if (!follow || !el) return;
  const { scene, pos } = follow;
  const cam = scene.cameras.main, canvas = scene.game.canvas;
  const cr = canvas.getBoundingClientRect(), sr = el.parentElement!.getBoundingClientRect();
  const k = cr.width / canvas.width;
  const p = pos();
  let x = (p.x - cam.worldView.x) * cam.zoom * k + cr.left - sr.left;
  const y = (p.y - cam.worldView.y) * cam.zoom * k + cr.top - sr.top;
  // 화면 밖으로 안 나가게 좌우 보정
  const half = el.offsetWidth / 2;
  x = Math.max(half + 6, Math.min(sr.width - half - 6, x));
  el.style.left = `${x}px`;
  el.style.top = `${Math.max(el.offsetHeight + 4, y)}px`;
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
export function ago(ms: number) {
  const s = (Date.now() - ms) / 1000;
  return s < 60 ? "방금" : s < 3600 ? `${Math.floor(s / 60)}분 전` : s < 86400 ? `${Math.floor(s / 3600)}시간 전` : `${Math.floor(s / 86400)}일 전`;
}
