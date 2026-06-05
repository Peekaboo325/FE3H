// ─────────────────────────────────────────────────────────────────────────
//  활성 인물 → 프롬프트용 '현재 등장인물' 블록 조립 (순수 함수).
//
//  정책 B: 핵심(이름·이명·소속·정의·성격)은 늘 넣고,
//          상황 정보(외양·무기·비고)는 '참조용 — 필요할 때만' 라벨을 달아 함께 넣는다.
//          + "습관적으로 나열하지 말 것" 지시로 남발을 막는다.
//  ※ 썸네일은 넣지 않는다(프롬프트에 불필요·고비용).
// ─────────────────────────────────────────────────────────────────────────

export function buildCharacterContext(characters) {
  const active = (characters || []).filter((c) => c && c.is_active !== false && c.name);
  if (active.length === 0) return '';

  const 인물블록 = active.map((c) => {
    const 이름 = c.english_name ? `${c.name} (${c.english_name})` : c.name;
    const core = [`■ ${이름}`];
    if (c.aliases) core.push(`  - 이명: ${c.aliases}`);
    if (c.faction) core.push(`  - 소속: ${c.faction}`);
    if (c.title) core.push(`  - 정의: ${c.title}`);
    if (c.life_status === 'deceased') core.push('  - 상태: 사망');
    else if (c.life_status === 'unknown') core.push('  - 상태: 생사 불명');
    if (c.personality) core.push(`  - 성격·내면: ${c.personality}`);

    const ref = [];
    if (c.appearance) ref.push(`    · 외양: ${c.appearance}`);
    if (c.combat) ref.push(`    · 무기·전투: ${c.combat}`);
    if (c.notes) ref.push(`    · 비고: ${c.notes}`);

    let s = core.join('\n');
    if (ref.length) {
      s += '\n  [참조용 — 그 장면에 서사적으로 필요할 때만 꺼내 쓸 것]\n' + ref.join('\n');
    }
    return s;
  });

  return (
    '[현재 등장인물]\n' +
    '아래는 지금 무대에 오른 인물들의 설정이다. 이름·이명 표기는 반드시 이대로 따른다. ' +
    "'참조용'으로 표시된 외양·무기 등은 그 장면에 서사적으로 필요할 때만 꺼내 쓰고, " +
    '인물을 호명할 때마다 습관적으로 나열하지 말 것. 지금 장면에 필요한 인물·정보만 쓴다.\n\n' +
    인물블록.join('\n\n')
  );
}
