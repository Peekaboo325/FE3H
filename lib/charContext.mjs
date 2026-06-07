// ─────────────────────────────────────────────────────────────────────────
//  활성 인물 → 프롬프트용 '현재 등장인물' 블록 조립 (순수 함수).
//
//  정책 B: 핵심(이름·이명·성별·소속·신분·상태·성향)은 늘 넣고,
//          상황 정보(용모·전법·문장·거점·비고)는 '참조용 — 필요할 때만' 라벨.
//          인연(관계)은 이름·관계·설명까지 넣는다(관계망은 서사 핵심).
//          + "습관적으로 나열하지 말 것" 지시로 남발을 막는다.
//  ※ 썸네일/이미지는 넣지 않는다(불필요·고비용).
// ─────────────────────────────────────────────────────────────────────────

export function buildCharacterContext(characters) {
  const active = (characters || []).filter((c) => c && c.is_active !== false && c.name);
  if (active.length === 0) return '';

  const 인물블록 = active.map((c) => {
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
  });

  return (
    '[현재 등장인물]\n' +
    '아래는 지금 무대에 오른 인물들의 설정이다. 이름·이명 표기는 반드시 이대로 따른다. ' +
    "'참조용'으로 표시된 용모·전법 등은 그 장면에 서사적으로 필요할 때만 꺼내 쓰고, " +
    '인물을 호명할 때마다 습관적으로 나열하지 말 것. 지금 장면에 필요한 인물·정보만 쓴다.\n\n' +
    인물블록.join('\n\n')
  );
}
