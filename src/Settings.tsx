// 설정 — 본문(메인 서사) 생성 모델·사고 깊이를 빌더가 직접 고른다.
//  값은 localStorage에 남고, /api/story·/api/regen 요청 본문으로 보내진다(서버가 genConfig로 검증).
//  ※ 이건 빌더용 셋업 컨트롤이라 기술어를 남겨둔다(CLAUDE.md §1 예외).
import Modal from './Modal';

export type GenConfig = { model: string; effort: string };

const MODELS = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', desc: '깊은 붓 — 문장력의 핵심 (권장)' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: '빠르고 가벼운 붓 — 비용 절감' },
];
const EFFORTS = [
  { id: 'medium', label: '중간', desc: '더 깊이 생각 — 사실 정밀도↑ (비용·시간↑)' },
  { id: 'low', label: '낮음', desc: '생각을 줄여 — 빠르고 쌈' },
];

function Group({
  label,
  hint,
  options,
  value,
  onPick,
}: {
  label: string;
  hint: string;
  options: { id: string; label: string; desc: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="settings-group">
      <div className="settings-label">{label}</div>
      <p className="settings-hint">{hint}</p>
      <div className="settings-options">
        {options.map((o) => (
          <button
            key={o.id}
            className={'settings-opt' + (value === o.id ? ' on' : '')}
            onClick={() => onPick(o.id)}
          >
            <span className="settings-opt-label">{o.label}</span>
            <span className="settings-opt-desc">{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Settings({
  config,
  onChange,
  onClose,
}: {
  config: GenConfig;
  onChange: (c: GenConfig) => void;
  onClose: () => void;
}) {
  return (
    <Modal title="설정" onClose={onClose} className="modal--settings">
      <div className="settings">
        <Group
          label="서술자"
          hint="본문을 짓는 모델. Opus가 문장력의 핵심입니다 — Sonnet은 빠르고 싼 대신 결이 가볍습니다."
          options={MODELS}
          value={config.model}
          onPick={(model) => onChange({ ...config, model })}
        />
        <Group
          label="사고 깊이"
          hint="본문을 쓰기 전 '생각'의 양. 깊을수록 정밀하나 비용·시간이 늡니다."
          options={EFFORTS}
          value={config.effort}
          onPick={(effort) => onChange({ ...config, effort })}
        />
      </div>
    </Modal>
  );
}
