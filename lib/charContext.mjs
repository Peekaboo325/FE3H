// ─────────────────────────────────────────────────────────────────────────
//  활성 인물 → 프롬프트용 '현재 등장인물' 블록 조립 (순수 함수).
//
//  정책 B: 핵심(이름·이명·성별·소속·신분·상태·성향)은 늘 넣고,
//          상황 정보(용모·전법·문장·거점·비고)는 '참조용 — 필요할 때만' 라벨.
//          인연(관계)은 이름·관계·설명까지 넣는다(관계망은 서사 핵심).
//          + "습관적으로 나열하지 말 것" 지시로 남발을 막는다.
//  ※ 썸네일/이미지는 넣지 않는다(불필요·고비용).
// ─────────────────────────────────────────────────────────────────────────

// 인물 한 명 → 약력 블록(정책 B). buildCharacterContext(상주)·buildSummonedCharacters(앵커 소환) 공용.
function 인물한명(c) {
  const 이름 = c.english_name ? `${c.name} (${c.english_name})` : c.name;
  const core = [`■ ${이름}`];
  if (c.aliases) core.push(`  - 이명: ${c.aliases}`);
  if (c.gender) core.push(`  - 성별: ${c.gender}`);
  if (c.faction) core.push(`  - 소속: ${c.faction}`);
  if (c.rank) core.push(`  - 신분: ${c.rank}`);
  if (c.life_status === 'deceased') core.push('  - 상태: 사망');
  else if (c.life_status === 'unknown') core.push('  - 상태: 생사 불명');
  if (c.personality) core.push(`  - 성향: ${c.personality}`);

  // 용모 5항목 → 한 줄로 합침
  const 용모 = [
    c.height && `신장 ${c.height}`,
    c.build && `체격 ${c.build}`,
    c.hair && `모발 ${c.hair}`,
    c.iris && `홍채 ${c.iris}`,
    c.impression && `인상 ${c.impression}`,
  ]
    .filter(Boolean)
    .join(', ');

  const ref = [];
  if (용모) ref.push(`    · 용모: ${용모}`);
  if (c.combat) ref.push(`    · 전법: ${c.combat}`);
  if (c.crest) ref.push(`    · 문장: ${c.crest}`);
  if (c.base) ref.push(`    · 거점: ${c.base}`);
  if (c.notes) ref.push(`    · 비고: ${c.notes}`);

  const bonds = Array.isArray(c.bonds) ? c.bonds.filter((b) => b && b.name) : [];

  let s = core.join('\n');
  if (ref.length) {
    s += '\n  [참조용 — 그 장면에 서사적으로 필요할 때만 꺼내 쓸 것]\n' + ref.join('\n');
  }
  if (bonds.length) {
    const 인연 = bonds.map((b) => {
      const head = b.category ? `${b.name} (${b.category})` : b.name;
      return b.description ? `    · ${head}: ${b.description}` : `    · ${head}`;
    });
    s += '\n  [인연]\n' + 인연.join('\n');
  }
  return s;
}

// 메모를 본문으로 베끼지 말라는 공통 가드(상주·소환 동일).
const 인물주입가드 =
  '이름·이명 표기는 반드시 이대로 따른다. ' +
  '이 항목들은 인물을 식별·기억하기 위한 메모일 뿐 본문 문장이 아니다 — 메모에 적힌 표현을 본문에 그대로 옮기지 말 것. ' +
  '특히 성향·인상·비고에 평가나 비유로 적힌 말은 서술로 받아 적지 않는다: 가령 인상에 "여신 같은 미모"라 적혀 있어도 그 문구를 본문에 그대로 쓰지 말고, ' +
  '그 인상이 드러나는 구체적 행동·몸짓·타인의 반응으로 풀어 보여준다(작법의 보여주기). ' +
  "'참조용'으로 표시된 용모·전법 등은 그 장면에 서사적으로 필요할 때만 꺼내 쓰고, " +
  '인물을 호명할 때마다 습관적으로 나열하지 말 것. 지금 장면에 필요한 인물·정보만 쓴다.';

export function buildCharacterContext(characters) {
  const active = (characters || []).filter((c) => c && c.is_active !== false && c.name);
  if (active.length === 0) return '';
  return (
    '[현재 등장인물]\n' +
    '아래는 지금 무대에 오른 인물들의 설정이다. ' +
    인물주입가드 +
    '\n\n' +
    active.map(인물한명).join('\n\n')
  );
}

// 앵커 소환 — 작가가 "이름 등장"으로 지목해 부른 인물(비활성 포함). 활성 필터 없음.
//  캐시 경계 뒤에 주입되므로 상주 인물 캐시를 안 깬다(설계: anchor.mjs buildCharacterAnchorContext).
export function buildSummonedCharacters(chars) {
  const list = (chars || []).filter((c) => c && c.name);
  if (list.length === 0) return '';
  return (
    '[이 장면에 부른 인물 — 작가가 지목]\n' +
    '아래 인물(들)을 이번 화에 등장시킨다. ' +
    인물주입가드 +
    '\n\n' +
    list.map(인물한명).join('\n\n')
  );
}
