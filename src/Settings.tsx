// 본문 생성 모델·사고 깊이 컨트롤 — '천각의 박동'(Stories) 안에 박힌다(별도 메뉴 아님).
//  값은 App이 localStorage에 남기고 /api/story·regen 본문으로 보낸다(서버가 genConfig로 검증).
//  ※ 빌더용 셋업 컨트롤이라 기술어를 남겨둔다(CLAUDE.md §1 예외).

export type GenConfig = { model: string; effort: string; enrich: boolean; polish: boolean };

const MODELS = [
  // ⚠️ Opus 4.8 잠깐 걷어둠(2026-06-19, 비용 사고) — 복구: { id: 'claude-opus-4-8', label: 'Opus 4.8' } 다시 추가
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
];
// 사고 깊이 = 클로드 effort. '낮음/중간'은 '높음'을 기대하게 해 어색 → 단계 표기(1단계=low, 2단계=medium).
const EFFORTS = [
  { id: 'low', label: '1단계' },
  { id: 'medium', label: '2단계' },
];
// 공용 on/off 토글 — 연출 콘티(본문 전 콘티 펼치기)·후보정(Flash 2차 교정)에 함께 쓴다. 둘 다 딥시크 한정.
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
      {/* 후보정 = 1차 본문을 Flash가 절제 보정으로 다듬는 2차 교정. 딥시크 본문 전용 → 딥시크일 때만 활성 */}
      <Group
        label="후보정"
        options={TOGGLE}
        value={config.polish ? 'on' : 'off'}
        onPick={(v) => onChange({ ...config, polish: v === 'on' })}
        disabled={!isDeep}
      />
    </div>
  );
}
