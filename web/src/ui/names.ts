// 직원 이름과 직급: 같은 key(프로젝트)는 언제나 같은 이름
import { hash } from "../gfx/people";

const SURNAME = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
const GIVEN = ["서연", "민준", "지호", "하은", "도윤", "예린", "시우", "수아", "준서", "지아", "현우", "채원", "유진", "태민", "다은", "건우",
  "소율", "주원", "나연", "은호", "서진", "하린", "윤재", "지민", "세아", "도현", "가은", "우진", "이안", "보람"];

export function personName(key: string) {
  const h = hash(key + "#name");
  return SURNAME[h % SURNAME.length] + GIVEN[(h >> 5) % GIVEN.length];
}

/** 누적 도구 호출 수로 직급 */
export const RANKS = [
  { min: 0, title: "인턴" }, { min: 10, title: "사원" }, { min: 50, title: "대리" }, { min: 150, title: "과장" }, { min: 400, title: "부장" },
];
export function rankOf(toolCount = 0) {
  let r = 0;
  RANKS.forEach((k, i) => { if (toolCount >= k.min) r = i; });
  return { index: r, title: RANKS[r].title };
}

/** 지금 맡은 역할 (구역 기준) */
export const ROLE: Record<string, string> = {
  think: "생각 정리", dev: "코딩", lib: "자료 찾기", srv: "명령 실행", research: "웹 조사", meet: "서브에이전트 회의",
  gh: "GitHub 출장", plan: "Notion 출장", obsidian: "Obsidian 출장", ceo: "결재 대기", cafe: "휴식", nap: "수면", standup: "스탠드업",
};

/** 역할 별명: 지금 있는 부서에 맞춰 (같은 별명이 여럿이면 뒤에 번호) */
export const NICK: Record<string, string> = {
  think: "고민이", dev: "개발이", gh: "깃돌이", plan: "기획이", research: "조사리", obsidian: "노트리", lib: "책벌레", srv: "서버지기",
  meet: "회의러", ceo: "결재대기", cafe: "커피러", nap: "잠꾸러기", standup: "모임러",
};
/** B1 연구원 별명: 상태에 맞춰 */
export const LAB_NICK: Record<string, string> = { working: "실험이", quiet: "고민이", sleep: "잠꾸러기", done: "박사님" };
