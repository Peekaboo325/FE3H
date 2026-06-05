
import { StoryParams } from './types/index';

/**
 * [서술 분위기 제어 엔진 v2.0]
 * 현대적 은어 유출(Instruction Leakage)을 방지하기 위해 모든 자극적 단어를 문학적 묘사로 치환했습니다.
 * 또한 Negative Constraints를 추가하여 AI가 사용하는 어휘의 품격을 강제합니다.
 */

const SENSUALITY_INSTRUCTIONS = [
  "Level 1: Vanilla/Romantic (순애/정석). 핵심: 영혼의 공명과 정서적 교감이 기반이 되는 숭고한 결합. 키워드: 깊은 눈맞춤, 섬세한 애무, 떨리는 고백, 온기를 나누는 후희. AI 지침: Standard 'Vanilla' interaction. Prioritize emotional bonding, tenderness, and gentle rhythm. Describe mutual love and spiritual intimacy with elegance.",
  "Level 2: Passionate/Active (열정/적극). 핵심: 서로의 존재를 갈구하는, 열기와 땀방울이 서린 격렬한 교감. 키워드: 호흡의 뒤섞임, 주도권의 끊임없는 교차, 탐닉하는 손길, 신체적 열망의 분출. AI 지침: High energy and physical eagerness. Focus on the visceral heat and the rhythmic intensity of mutual desire. Describe the sensory experience vividly yet tastefully.",
  "Level 3: Kink/Fetish (자극/변칙). 핵심: 일상을 벗어난 특별한 유희, 혹은 감각의 전이를 통한 탐색. 키워드: 시각적 자극(거울/의복), 감각의 구속과 해방, 은밀한 역할극, 특정 부위에 대한 탐미적 집착. AI 지침: Explore specific fantasies and sensory deviations. Focus on the psychological tension of power play or unusual stimuli that heighten the atmosphere of the scene.",
  "Level 4: Hardcore/Rough (거침/지배). 핵심: 압도적인 무력과 권위 아래 굴복하거나, 자제력을 잃고 거칠게 몰아붙이는 행위. 키워드: 위압적인 어조, 강제성을 띤 정복, 신체적 한계까지 몰아넣는 압박, 수치심을 자극하는 언사. AI 지침: Heavy physical and verbal dominance. Describe scenes where power dynamics shift toward overwhelming force. Focus on the raw impact and the character's struggle between resistance and submission.",
  "Level 5: Extreme/Dark (심연/각인). 핵심: 윤리적 경계가 무너진 원초적 본능의 지배. 자아의 소멸과 영구적인 귀속에 대한 집착. 키워드: 정신적 무너짐, 본능적이고 무거운 결합, 이성을 잃고 황홀경에 빠진 표정, 체액과 신체의 적나라한 마찰, 번식과 각인을 향한 맹목적 충동. AI 지침: The most visceral level (R-19+). Focus on primal instincts, the complete conquest of the partner's will, and the raw, unpolished sensations of physical union. Use poetic but blunt metaphors to describe deep internal impact and the loss of self."
];

const SPEED_INSTRUCTIONS = [
  "Level 1: Micro/Sensory (찰나/감각). 핵심: 시간이 멈춘 듯한 세밀한 묘사. 키워드: 사물의 질감, 미세한 표정 변화, 탐미적 서술, 정적인 호흡. AI 지침: Micro-detailed and sensory. Focus on the texture, smell, and subtle nuances as if time has stopped. Highly aesthetic.",
  "Level 2: Lyrical/Slow (서정/느림). 핵심: 인물의 심연을 파고드는 느린 호흡. 키워드: 비유적 표현, 긴 호흡, 풍부한 문체, 내면의 풍경. AI 지침: Lyrical and slow-paced. Dive deep into the character's psyche with rich, poetic language and reflective descriptions.",
  "Level 3: Balanced/Standard (표준/균형). 핵심: 사건과 묘사의 적절한 조화. 키워드: 안정적인 흐름, 육하원칙, 선명한 인과관계. AI 지침: Balanced and standard pace. Maintain a steady flow between narrative progression and atmospheric description.",
  "Level 4: Urgent/Action (긴박/액션). 핵심: 빠르고 박진감 넘치는 액션 중심의 전개. 키워드: 단문, 동사 중심, 박동감, 긴박한 상황. AI 지침: Urgent and action-oriented. Use short, punchy sentences and dynamic verbs to drive the story forward with high energy.",
  "Level 5: Summary/Skip (요약/과감). 핵심: 핵심 사건 위주의 파격적인 전개. 키워드: 대담한 생략, 결과 중심, 시간 도약, 함축적 서술. AI 지침: Bold summary and time skips. Focus only on the pivotal turning points. Omit unnecessary details to reach the conclusion swiftly."
];

/**
 * [Negative Constraints: VOCABULARY SANITIZATION]
 * AI가 지침을 오인하여 저급한 단어를 직접 출력하는 것을 방지하는 강력한 금지령입니다.
 */
const NEGATIVE_CONSTRAINTS = `
[절대 준수: 어휘 살균 및 문학적 교정]
1. **현대 은어 절대 금지**: '아헤가오', '교배 프레스', '입싸', '떡' 등 현대 성인물에서 쓰이는 저속한 표현을 출력물에 노출하는 것을 엄격히 금지함.
2. **문학적 치환**: 위 개념을 묘사해야 할 경우, "이성을 잃고 황홀경에 젖은 표정", "본능의 무게로 짓누르는 압도적인 결합", "영구히 각인시키려는 듯한 맹목적인 행위" 등 중세 판타지의 비장미가 느껴지는 수려한 비유로 서술할 것.
3. **격조 유지**: 수위가 높을수록 문장은 더욱 탐미적이고 감각적이어야 하며, 시스템적인 단어 사용을 지양할 것.
`;

export const getStoryParamInstructions = (params: StoryParams): string => {
  return `
[NARRATIVE ATMOSPHERE CONTROL v2.0]
1. SENSUALITY (Level ${params.sensuality}): ${SENSUALITY_INSTRUCTIONS[params.sensuality - 1]}
2. SPEED (Level ${params.speed}): ${SPEED_INSTRUCTIONS[params.speed - 1]}

${NEGATIVE_CONSTRAINTS}

위 설정값에 따른 서술 지침을 최우선적으로 준수하여 소설을 집필하십시오.
`;
};
