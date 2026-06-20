// 일상(日常) 탭 — 인물의 '살아 있는 나날'. 일지를 엎고 그 자리를 대체한다(설계 docs/일상_설계.md).
//  자립 기둥: 연료를 '턴'이 아니라 인물 프로필·세계·관계·정사에서 가져온다 → Opus 꺼져도, 본문이 백지여도 논다.
//  화면 = 3구획(§11): [거처 삽화 — 스킨] / [근황(안색·지갑) + 격려·조달·육성 버튼] / [활동 로그 — 심장].
//  ⚠️ 가림 판정은 '자기칸'(daily.setup_at)으로만 — analysis 통째 truthy로 보지 말 것(§14 빈화면 버그 교훈).
//  0단계 = 껍데기(빈 3구획) + 현황 설정 면(빌더가 재능 ≤3·특성·수입을 직접 깐다 — AI 안 거침, 피플 생성하듯).
//   재능 = 고른 능력 C·나머지 E에서 시작(start_grades로 파생 저장). 천장 C, B·A·S는 육성으로만.
//   능력 적립·경제·상태·로그·버튼은 단계별로 채운다.
import { useState } from 'react';
import type { CharReport, DailyState, AbilityKey, Grade, IncomeGrade } from './useCharacters';
import { TRAITS } from './traits';
import { UI } from './strings';
import Button from './Button';
import Dropdown from './Dropdown';

// 능력 6각 — 무력·마력·신앙·지성·매력·정신(입지·재력은 일상에서 뺌: 재력→지갑, 입지→보고서). 키는 보고서와 공유.
const 능력6각: [AbilityKey, string][] = [
  ['prowess', '무력'],
  ['magic', '마력'],
  ['faith', '신앙'],
  ['intellect', '지성'],
  ['charm', '매력'],
  ['resilience', '정신'],
];
const 수입등급들: IncomeGrade[] = ['없음', '하', '중', '상'];
const 수입옵션 = 수입등급들.map((g) => ({ value: g, label: g }));
const 재능정원 = 3; // 재능은 최대 셋 — 고르면 C, 나머지는 E에서 시작

export default function DailyTab({
  report,
  saving,
  onSetup,
}: {
  report?: CharReport | null;
  saving: boolean;
  onSetup: (patch: Partial<DailyState>) => Promise<boolean>;
}) {
  const daily = report?.daily;
  const ready = !!daily?.setup_at; // 빌더가 세팅을 한 번 깔았는가
  const [mode, setMode] = useState<'view' | 'setup'>('view');

  // 세팅 폼 상태 — 진입할 때 기존값(편집)이나 기본값(신규: 재능·특성 없음·수입 없음)으로 채운다.
  const [talents, setTalents] = useState<AbilityKey[]>([]);
  const [traitNames, setTraitNames] = useState<string[]>([]); // 고른 특성 이름들(사전 TRAITS에서)
  const [income, setIncome] = useState<IncomeGrade>('없음');

  function 세팅열기() {
    setTalents(daily?.talents ?? []);
    // 저장된 특성 중 현재 사전에 있는 것만(폐기된 표기는 흘림). 사전 순서로 정렬.
    const saved = new Set((daily?.traits ?? []).map((t) => t.name));
    setTraitNames(TRAITS.filter((t) => saved.has(t.name)).map((t) => t.name));
    setIncome(daily?.income_grade ?? '없음');
    setMode('setup');
  }

  // 재능 토글 — 이미 골랐으면 빼고, 정원(3) 안이면 더한다. 정원 넘으면 무시.
  function 재능토글(k: AbilityKey) {
    setTalents((ts) => (ts.includes(k) ? ts.filter((x) => x !== k) : ts.length >= 재능정원 ? ts : [...ts, k]));
  }

  // 특성 토글 — 사전에서 켜고 끈다(개수 제한·상극은 4단계 육성에서). 다중 선택.
  function 특성토글(name: string) {
    setTraitNames((ns) => (ns.includes(name) ? ns.filter((x) => x !== name) : [...ns, name]));
  }

  async function 기록() {
    // 재능 = C, 나머지 = E로 시작 등급을 파생해 함께 저장(다음 단계가 등급을 한 결로 읽게).
    const start_grades: Partial<Record<AbilityKey, Grade>> = {};
    for (const [k] of 능력6각) start_grades[k] = talents.includes(k) ? 'C' : 'E';
    const patch: Partial<DailyState> = {
      talents,
      start_grades,
      // 고른 특성을 사전 순서로(이름+매인 능력) 저장. 이름이 곧 키.
      traits: TRAITS.filter((t) => traitNames.includes(t.name)).map((t) => ({ name: t.name, ability: t.ability })),
      income_grade: income,
    };
    if (await onSetup(patch)) setMode('view');
  }

  // ── 세팅 면 — 빌더가 시작 등급·특성·수입을 직접 깐다(한 번 정하면 끝, 이후 변화는 육성·전개로). ──
  if (mode === 'setup') {
    return (
      <div className="daily-setup">
        <div className="view-section">
          <div className="view-label">재능</div>
          <div className="daily-talents">
            {능력6각.map(([k, ko]) => {
              const on = talents.includes(k);
              const full = talents.length >= 재능정원 && !on;
              return (
                <button
                  key={k}
                  type="button"
                  className={'daily-talent' + (on ? ' on' : '') + (full ? ' full' : '')}
                  onClick={() => 재능토글(k)}
                >
                  {ko}
                  <span className="daily-talent-g">{on ? 'C' : 'E'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="view-section">
          <div className="view-label">특성</div>
          <div className="daily-trait-groups">
            {능력6각.map(([ability, ko]) => (
              <div className="daily-trait-group" key={ability}>
                <span className="daily-trait-ability">{ko}</span>
                <div className="daily-trait-chips">
                  {TRAITS.filter((t) => t.ability === ability).map((t) => {
                    const on = traitNames.includes(t.name);
                    return (
                      <button
                        key={t.name}
                        type="button"
                        className={'daily-chip' + (on ? ' on' : '')}
                        onClick={() => 특성토글(t.name)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="view-section">
          <div className="view-label">수입</div>
          <Dropdown value={income} options={수입옵션} onChange={(v) => setIncome(v as IncomeGrade)} />
        </div>

        <div className="daily-set-actions">
          <Button variant="secondary" onClick={() => setMode('view')}>
            {UI.cancel}
          </Button>
          <Button variant="primary" loading={saving} onClick={기록}>
            {UI.save}
          </Button>
        </div>
      </div>
    );
  }

  // 세팅 후 골격(3구획) — 내용은 단계별로 채운다.
  const skeleton = (
    <div className="daily">
      <div className="daily-skin" />
      <div className="daily-status" />
      <div className="daily-log" />
    </div>
  );

  // ── 세팅 전 — 빌더가 직접 깔아야 일상이 돈다(잠금 화면 + '일상 세팅' 진입). ──
  if (!ready) {
    return (
      <div className="report-locked">
        <div className="report--ghost" aria-hidden="true">
          {skeleton}
        </div>
        <div className="report-lock-overlay">
          <p className="report-lock-msg">아직 현황이 정해지지 않았습니다.</p>
          <button className="list-btn" onClick={세팅열기}>
            현황 설정
          </button>
        </div>
      </div>
    );
  }

  // ── 세팅 후 — 3구획 + 세팅 다시 열기(우상단). ──
  return (
    <div className="daily">
      <div className="daily-top">
        <button className="daily-edit" onClick={세팅열기}>
          현황 설정
        </button>
      </div>
      <div className="daily-skin" />
      <div className="daily-status" />
      <div className="daily-log" />
    </div>
  );
}
