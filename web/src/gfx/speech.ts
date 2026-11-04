// 머리 위 말풍선 (캔버스 안): 꼬리 달린 둥근 상자 + 글씨
//  work = 지금 하는 일 (주황 테두리, 계속 떠 있음) / wait = 내 확인 필요 (노랑) / chat = 잡담 (크림) / plain = 작은 표시
import Phaser from "phaser";
import { DEPTH } from "./ambience";

export type SpeechKind = "work" | "wait" | "chat" | "plain";
const STYLE: Record<SpeechKind, { fill: number; line: number; lw: number; ink: string; size: number }> = {
  work: { fill: 0xfff3e6, line: 0xe8875a, lw: 1.5, ink: "#2a1d1c", size: 7 },
  wait: { fill: 0xffe9a8, line: 0xc9973a, lw: 1.5, ink: "#2a1d1c", size: 7 },
  chat: { fill: 0xfbf3e2, line: 0x2a1d1c, lw: 1, ink: "#2a1d1c", size: 6.5 },
  plain: { fill: 0xf6ead2, line: 0x2a1d1c, lw: 1, ink: "#2a1d1c", size: 6.5 },
};

export class Speech {
  box: Phaser.GameObjects.Container;
  g: Phaser.GameObjects.Graphics;
  t: Phaser.GameObjects.Text;
  key = "";
  h = 0;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics();
    this.t = scene.add.text(0, 0, "", { fontFamily: "Galmuri11, ui-monospace, monospace", fontSize: "7px", color: "#2a1d1c", align: "center", lineSpacing: 1 })
      .setOrigin(0.5).setResolution(4);
    this.box = scene.add.container(0, 0, [this.g, this.t]).setDepth(DEPTH.icon).setVisible(false);
  }
  set(text: string, kind: SpeechKind = "plain") {
    const key = kind + "|" + text;
    if (key === this.key) return;
    this.key = key;
    if (!text) { this.box.setVisible(false); return; }
    const st = STYLE[kind];
    this.t.setText(text).setFontSize(st.size).setColor(st.ink);
    const w = Math.ceil(this.t.width) + 9, h = Math.ceil(this.t.height) + 5;
    this.h = h;
    const g = this.g.clear();
    g.fillStyle(0x000000, 0.22).fillRoundedRect(-w / 2 + 1, -h - 4 + 1, w, h, 4);                       // 그림자
    g.fillStyle(st.fill, 1).fillRoundedRect(-w / 2, -h - 4, w, h, 4);
    g.lineStyle(st.lw, st.line, 1).strokeRoundedRect(-w / 2, -h - 4, w, h, 4);
    g.fillStyle(st.fill, 1).fillTriangle(-3, -4.5, 3, -4.5, 0, 0);                                     // 꼬리
    g.lineStyle(st.lw, st.line, 1).lineBetween(-3, -4, 0, 0).lineBetween(3, -4, 0, 0);
    if (kind === "work") g.fillStyle(st.line, 1).fillCircle(-w / 2 + 4, -h - 4 + 4, 1.4);              // 작업 중 점
    this.t.setPosition(0.5, -h / 2 - 4);
    this.box.setVisible(true);
  }
  at(x: number, y: number, bob = 0) { this.box.setPosition(Math.round(x), Math.round(y + bob)); }
  get visible() { return this.box.visible; }
  get text() { return this.t.text; }
  destroy() { this.box.destroy(); }
}

/** "파일 고치는 중: server.js" → 두 줄 */
export function twoLines(s: string, max = 18) {
  const i = s.indexOf(": ");
  const cut = (x: string) => (x.length > max ? x.slice(0, max - 1) + "…" : x);
  return i < 0 ? cut(s) : `${cut(s.slice(0, i))}\n${cut(s.slice(i + 2))}`;
}
