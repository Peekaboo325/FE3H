// 본문 생성 모델·사고 깊이 컨트롤 — '천각의 박동'(Stories) 안에 박힌다(별도 메뉴 아님).
//  값은 App이 localStorage에 남기고 /api/story·regen 본문으로 보낸다(서버가 genConfig로 검증).
//  ※ 빌더용 셋업 컨트롤이라 기술어를 남겨둔다(CLAUDE.md §1 예외).

export type GenConfig = { model: string; effort: string };

const MODELS = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
];
const EFFORTS = [
  { id: 'medium', label: '중간' },
  { id: 'low', label: '낮음' },
];

function Group({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="settings-group">
      <div className="settings-label">{label}</div>
      <div className="settings-options">
        {options.map((o) => (
          <button
            key={o.id}
            className={'settings-opt' + (value === o.id ? ' on' : '')}
            onClick={() => onPick(o.id)}
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
      />
    </div>
  );
}
