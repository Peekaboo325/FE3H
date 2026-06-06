import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

// 네이티브 select 대신 디자인 가능한 드롭다운.
export default function Dropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const sel = options.find((o) => o.value === value);

  return (
    <div className={'dd' + (open ? ' open' : '')} ref={ref}>
      <button type="button" className="dd-btn" onClick={() => setOpen((o) => !o)}>
        <span className={'dd-val' + (sel ? '' : ' ph')}>{sel ? sel.label : placeholder || ''}</span>
        <ChevronDown className="dd-chev" size={16} />
      </button>
      {open && (
        <ul className="dd-list">
          {options.map((o) => (
            <li
              key={o.value}
              className={'dd-opt' + (o.value === value ? ' on' : '')}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label || ' '}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
