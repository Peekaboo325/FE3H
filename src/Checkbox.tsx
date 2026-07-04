import { Check } from 'lucide-react';

// 공용 체크박스 — 라벨 + 네모 상자(켜지면 금빛+체크). 새 on/off 필요할 때 여기서 꺼내 쓴다(개별 CSS 금지).
export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={'checkbox' + (checked ? ' on' : '')}
      onClick={() => onChange(!checked)}
      disabled={disabled}
    >
      <span className="checkbox-box">{checked && <Check size={13} strokeWidth={3} />}</span>
      <span className="checkbox-label">{label}</span>
    </button>
  );
}
