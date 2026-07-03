// 본문 생성 모델·사고 깊이 컨트롤 — '천각의 박동'(Stories) 안에 박힌다(별도 메뉴 아님).
//  값은 App이 localStorage에 남기고 /api/story·regen 본문으로 보낸다(서버가 genConfig로 검증).
//  ※ 빌더용 셋업 컨트롤이라 기술어를 남겨둔다(CLAUDE.md §1 예외).

export type GenConfig = { model: string; effort: string; enrich: boolean; conti: string; polish: string };

const MODELS = [
  // ⚠️ Opus 4.8 잠깐 걷어둠(2026-06-19, 비용 사고) — 복구: { id: 'claude-opus-4-8', label: 'Opus 4.8' } 다시 추가
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
];
// 연출 모델(콘티 2차) — DeepSeek(연출만 시켰을 때 되는지 시험) / Sonnet·Opus(연출 강함, 비용↑). 서버 enrich가 허용목록 검증.
const CONTI = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet' },
  { id: 'claude-opus-4-8', label: 'Opus' },
];
// 교정 모델(윤문) — DeepSeek(절제·저비용) / Sonnet·Opus(문학 상향, 비용↑). Flash 제외(교정 voice 어긋남). 서버가 검증.
const POLISH = [
  { id: 'deepseek-v4-pro', label: 'DeepSeek' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet' },
  { id: 'claude-opus-4-8', label: 'Opus' },
];
// 사고 깊이 = 클로드 effort. '낮음/중간'은 '높음'을 기대하게 해 어색 → 단계 표기(1단계=low, 2단계=medium).
const EFFORTS = [
  { id: 'low', label: '1단계' },
  { id: 'medium', label: '2단계' },
];
// 연출 콘티(윤색) on/off — 짧은 1차를 본문 전에 '연출 콘티(2차)'로 펼쳐 실행 게이트를 거친다. 딥시크 한정(렌더러 보강).
const TOGGLE = [
  { id: 'on', label: '켬' },
  { id: 'off', label: '끔' },
];

function Group({
  label,
  options,
  value,
  onPick,
  disabled,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onPick: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className={'settings-group' + (disabled ? ' disabled' : '')}>
      <div className="settings-label">{label}</div>
      <div className="settings-options">
        {options.map((o) => (
          <button
            key={o.id}
            className={'settings-opt' + (value === o.id ? ' on' : '')}
            onClick={() => onPick(o.id)}
            disabled={disabled}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GenControls({
  config,
  onChange,
}: {
  config: GenConfig;
  onChange: (c: GenConfig) => void;
}) {
  // DeepSeek은 사고(thinking)가 본디 켜져 있어 effort가 안 먹는다 → 토글을 비활성(회색)으로 헷갈림 방지.
  const isDeep = config.model.startsWith('deepseek');
  return (
    <div className="settings">
      <Group
        label="서술자"
        options={MODELS}
        value={config.model}
        onPick={(model) => onChange({ ...config, model })}
      />
      <Group
        label="사고 깊이"
        options={EFFORTS}
        value={config.effort}
        onPick={(effort) => onChange({ ...config, effort })}
        disabled={isDeep}
      />
      {/* 연출 콘티는 딥시크 본문 전용 전처리 → 딥시크일 때만 활성 */}
      <Group
        label="연출 콘티"
        options={TOGGLE}
        value={config.enrich ? 'on' : 'off'}
        onPick={(v) => onChange({ ...config, enrich: v === 'on' })}
        disabled={!isDeep}
      />
      {/* 연출 모델 — 콘티를 어느 모델이 짓나. 딥시크 + 연출 콘티 켬일 때만 의미(그 외 비활성). */}
      <Group
        label="연출 모델"
        options={CONTI}
        value={config.conti}
        onPick={(conti) => onChange({ ...config, conti })}
        disabled={!isDeep || !config.enrich}
      />
      {/* 교정 모델 — '교정' 버튼이 어느 모델로 윤문하나. 본문 모델과 무관하게 늘 유효. */}
      <Group
        label="교정 모델"
        options={POLISH}
        value={config.polish}
        onPick={(polish) => onChange({ ...config, polish })}
      />
    </div>
  );
}
