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
const 특성정원 = 3; // 특성은 최대 셋. 또 한 능력당 하나(상반 특성은 서로 막음)

// 등급 사다리 11단계(설계 §6, S+ 없음) — 표시·레이더 환산용. 속은 숫자(육성)는 4단계에서.
const 등급사다리 = ['E', 'E+', 'D', 'D+', 'C', 'C+', 'B', 'B+', 'A', 'A+', 'S'];
const 등급값 = (g?: string) => {
  const i = 등급사다리.indexOf(g ?? 'E');
  return i < 0 ? 0 : i / (등급사다리.length - 1); // 0(E)~1(S)
};

// 능력 6각 레이더 — 시작 등급을 육각형으로(SVG, 의존성 없음). 값은 등급→0~1 환산.
function DailyRadar({ grades }: { grades?: Partial<Record<AbilityKey, Grade>> }) {
  const size = 220;
  const c = size / 2;
  const R = c - 34; // 라벨 자리 여백
  const n = 능력6각.length; // 6
  const pt = (i: number, radius: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; // 12시부터 시계방향
    return [c + radius * Math.cos(a), c + radius * Math.sin(a)];
  };
  const poly = (radius: number | ((i: number) => number)) =>
    능력6각.map((_, i) => pt(i, typeof radius === 'function' ? radius(i) : radius).join(',')).join(' ');
  const val = (i: number) => R * 등급값(grades?.[능력6각[i][0]]);
  return (
    <svg className="daily-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="능력 등급">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} className="radar-ring" points={poly(R * f)} />
      ))}
      {능력6각.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} className="radar-axis" x1={c} y1={c} x2={x} y2={y} />;
      })}
      <polygon className="radar-area" points={poly(val)} />
      {능력6각.map(([, ko], i) => {
        const [x, y] = pt(i, R + 18);
        return (
          <text key={i} className="radar-label" x={x} y={y} textAnchor="middle" dominantBaseline="central">
            {ko}
          </text>
        );
      })}
    </svg>
  );
}

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
  // 고른 특성 = 사전 키(name) → 표시 이름(label). 키 있으면 선택, 값은 그 인물용 이름(기본=사전 이름).
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null); // 인라인 개칭 중인 사전 키
  const [editVal, setEditVal] = useState('');
  const [income, setIncome] = useState<IncomeGrade>('없음');

  function 세팅열기() {
    setTalents(daily?.talents ?? []);
    // 저장된 특성 중 현재 사전에 있는 것만(폐기된 표기는 흘림). 인물용 표시 이름(label)이 있으면 그것.
    const saved = new Map((daily?.traits ?? []).map((t) => [t.name, t.label || t.name] as const));
    const next: Record<string, string> = {};
    for (const t of TRAITS) if (saved.has(t.name)) next[t.name] = saved.get(t.name)!;
    setPicked(next);
    setEditing(null);
    setIncome(daily?.income_grade ?? '없음');
    setMode('setup');
  }

  // 재능 토글 — 이미 골랐으면 빼고, 정원(3) 안이면 더한다. 정원 넘으면 무시.
  function 재능토글(k: AbilityKey) {
    setTalents((ts) => (ts.includes(k) ? ts.filter((x) => x !== k) : ts.length >= 재능정원 ? ts : [...ts, k]));
  }

  // 특성 토글 — 사전에서 켜고 끈다(개수 제한·상극은 4단계 육성에서). 다중 선택. 끄면 인물용 이름도 비움.
  function 특성토글(name: string) {
    setPicked((p) => {
      const next = { ...p };
      if (name in next) delete next[name];
      else next[name] = name; // 처음엔 사전 이름 그대로
      return next;
    });
  }

  // 더블클릭 = 그 인물용 이름 개칭(흡인→자색). 선택 안 됐으면 켜면서 편집.
  function 개칭시작(name: string) {
    setPicked((p) => (name in p ? p : { ...p, [name]: name }));
    setEditVal(picked[name] ?? name);
    setEditing(name);
  }
  function 개칭마침() {
    if (editing) {
      const v = editVal.trim();
      setPicked((p) => ({ ...p, [editing]: v || editing })); // 비우면 사전 이름으로 되돌림
    }
    setEditing(null);
  }

  async function 기록() {
    // 재능 = C, 나머지 = E로 시작 등급을 파생해 함께 저장(다음 단계가 등급을 한 결로 읽게).
    const start_grades: Partial<Record<AbilityKey, Grade>> = {};
    for (const [k] of 능력6각) start_grades[k] = talents.includes(k) ? 'C' : 'E';
    const patch: Partial<DailyState> = {
      talents,
      start_grades,
      // 고른 특성을 사전 순서로 저장. name=기계 키, label=인물용 이름(사전과 다를 때만).
      traits: TRAITS.filter((t) => t.name in picked).map((t) => {
        const label = picked[t.name];
        return { name: t.name, ability: t.ability, ...(label && label !== t.name ? { label } : {}) };
      }),
      income_grade: income,
    };
    if (await onSetup(patch)) setMode('view');
  }

  // ── 세팅 면 — 빌더가 시작 등급·특성·수입을 직접 깐다(한 번 정하면 끝, 이후 변화는 육성·전개로). ──
  if (mode === 'setup') {
    // 특성 제약: 총 정원(3) + 한 능력당 하나(상반은 서로 막음). 이미 찬 능력·정원이면 못 고르게.
    const 찬능력 = new Set<AbilityKey>();
    for (const t of TRAITS) if (t.name in picked) 찬능력.add(t.ability);
    const 특성꽉 = Object.keys(picked).length >= 특성정원;
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
          <div className="daily-trait-chips">
            {TRAITS.map((t) => {
              const on = t.name in picked;
              const label = picked[t.name] ?? t.name;
              const 개칭됨 = on && label !== t.name; // 인물용으로 이름을 바꿈
              // 못 고름 = 안 골랐는데 (정원 찼거나 / 같은 능력에 이미 하나 = 상반 막음)
              const 막힘 = !on && (특성꽉 || 찬능력.has(t.ability));
              if (editing === t.name) {
                return (
                  <input
                    key={t.name}
                    className="daily-chip-edit"
                    autoFocus
                    value={editVal}
                    onChange={(e) => setEditVal(e.target.value)}
                    onBlur={개칭마침}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') 개칭마침();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                );
              }
              return (
                <button
                  key={t.name}
                  type="button"
                  className={'daily-chip' + (on ? ' on' : '')}
                  disabled={막힘}
                  onClick={() => 특성토글(t.name)}
                  onDoubleClick={() => 개칭시작(t.name)}
                  title={막힘 ? '' : '더블클릭으로 이름 개칭'}
                >
                  {label}
                  {개칭됨 && <span className="daily-chip-base">{t.name}</span>}
                </button>
              );
            })}
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

  // ── 세팅 후 — 능력 레이더(1단계). 거처 스킨·근황·활동 로그는 단계별로 채운다. ──
  return (
    <div className="daily">
      <div className="daily-top">
        <button className="daily-edit" onClick={세팅열기}>
          현황 설정
        </button>
      </div>
      <div className="view-section">
        <div className="view-label">능력</div>
        <div className="daily-abilities">
          <DailyRadar grades={daily?.start_grades} />
          <ul className="daily-grade-list">
            {능력6각.map(([k, ko]) => (
              <li key={k} className="daily-grade-row">
                <span className="daily-grade-ab">{ko}</span>
                <span className="daily-grade-g">{daily?.start_grades?.[k] ?? 'E'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
