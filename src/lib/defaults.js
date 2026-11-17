export const LEVEL_NAMES = { vg: "매우잘함", g: "잘함", n: "보통", e: "노력요함" };
export const LEVEL_SHORT = { vg: "매잘", g: "잘함", n: "보통", e: "노력" };
export const LEVEL_ORDER = ["vg", "g", "n", "e"];
export const AREAS = ["자율·자치활동", "동아리활동", "진로활동"];
export const CHIP_GROUPS = ["성품", "학습", "친구", "생활", "표현", "노력할 점"];

const C_SOURCE = {
  성품: ["예의 바름", "정직함", "차분함", "밝고 긍정적", "인사를 잘함", "약속을 잘 지킴", "감정 조절 잘함", "잘못을 솔직히 인정함"],
  학습: ["집중 잘함", "공부 잘함", "발표 잘함", "끝까지 해냄", "질문을 자주 함", "호기심 많음", "스스로 공부함", "책 읽기를 즐김", "과제를 성실히 함"],
  친구: ["교우 관계 좋음", "배려심 많음", "모둠 협력 잘함", "친구 말을 잘 들어 줌", "양보를 잘함", "다툼을 잘 중재함", "어려운 친구를 도움", "친구를 격려함"],
  생활: ["맡은 일 책임짐", "규칙 잘 지킴", "정리정돈 잘함", "준비물 잘 챙김", "시간 약속 잘 지킴", "궂은일에 앞장섬", "안전 수칙 잘 지킴", "학급 일에 적극적"],
  표현: ["글쓰기 잘함", "그리기 좋아함", "운동 잘함", "노래·악기 좋아함", "만들기 잘함", "창의적인 생각", "리더십 있음", "말로 생각을 잘 표현함"],
  "노력할 점": ["집중 시간 짧음", "발표 자신감 부족", "다툼 잦음", "정리 부족", "과제 마무리 부족", "준비물 자주 놓침", "수업 중 잡담", "감정 표현이 거침", "스스로 하기 어려움"],
};

export const DEFAULT_CHIPS_C = Object.entries(C_SOURCE).flatMap(([group, texts]) =>
  texts.map((text, i) => ({
    id: `c-${CHIP_GROUPS.indexOf(group)}-${i}`,
    group,
    text,
    negative: group === "노력할 점",
  })),
);

export const DEFAULT_CHIPS_B = [
  "사회 맡음", "기록 담당", "자료 준비", "아이디어 제안", "발표", "끝까지 참여", "친구 도움", "뒷정리",
].map((text, i) => ({ id: `b-${i}`, text }));

export function emptyState() {
  return {
    settings: {
      grade: 5,
      guideText: "",
      classNote: "",
      length: "normal",
      reportMaxChars: 300,
      hasSchoolGuide: false,
      reportGuideText: "",
      byteLimits: { A: null, B: null, C: 1500 },
      geminiKey: "",
      geminiModel: "",
    },
    students: [],
    nextStudentSeq: 1,
    evalPlan: [],
    activities: [],
    chips: {
      C: DEFAULT_CHIPS_C.map((c) => ({ ...c })),
      B: DEFAULT_CHIPS_B.map((c) => ({ ...c })),
    },
    inputs: {},
    drafts: {},
  };
}
