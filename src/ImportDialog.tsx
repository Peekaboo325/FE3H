import { useEffect, useState } from 'react';
import Dropdown from './Dropdown';
import { Check, X } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';

type Story = { id: number; title: string };

// 다른 이야기에서 항목(인물/견문록)을 '복사'해 현재 이야기로 가져온다.
// 복사본이라, 가져온 뒤 고쳐도 원본 이야기 것은 바뀌지 않는다.
export default function ImportDialog<T extends { id?: number }>({
  title,
  endpoint,
  itemsKey,
  payloadKey,
  currentStoryId,
  labelOf,
  onClose,
  onDone,
}: {
  title: string;
  endpoint: string; // '/api/characters' | '/api/lore'
  itemsKey: string; // 'characters' | 'lore'
  payloadKey: string; // 'character' | 'entry'
  currentStoryId: number;
  labelOf: (it: T) => string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [stories, setStories] = useState<Story[]>([]);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [items, setItems] = useState<T[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/stories')
      .then((r) => r.json())
      .then((d) => setStories((d.stories || []).filter((s: Story) => s.id !== currentStoryId)))
      .catch(() => {});
  }, [currentStoryId]);

  async function pickStory(id: number) {
    setSourceId(id);
    setItems([]);
    setPicked(new Set());
    setLoading(true);
    try {
      const r = await fetch(`${endpoint}?story_id=${id}`);
      const d = await r.json();
      setItems(Array.isArray(d[itemsKey]) ? d[itemsKey] : []);
    } catch {
      /* 무시 */
    }
    setLoading(false);
  }

  function toggle(id: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function 가져오기() {
    const 고른것 = items.filter((it) => it.id != null && picked.has(it.id));
    if (고른것.length === 0) return;
    setBusy(true);
    try {
      for (const it of 고른것) {
        const copy: Record<string, unknown> = { ...it };
        delete copy.id; // 새 항목으로(독립 복사)
        copy.story_id = currentStoryId;
        await fetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ [payloadKey]: copy }),
        });
      }
      onDone();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <IconButton label={UI.close} onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>

        <div className="modal-body import-body">
          <Dropdown
            value={sourceId != null ? String(sourceId) : ''}
            options={stories.map((s) => ({ value: String(s.id), label: s.title }))}
            onChange={(v) => pickStory(Number(v))}
            placeholder="반출할 장을 선택하십시오."
          />

          {sourceId != null && (
            <>
              {loading ? (
                <p className="dim import-msg">펼치는 중…</p>
              ) : items.length === 0 ? (
                <p className="dim import-msg">그 장엔 {UI.import}할 것이 없습니다.</p>
              ) : (
                <ul className="char-list import-list">
                  {items.map((it) => {
                    const on = it.id != null && picked.has(it.id);
                    return (
                      <li
                        key={it.id}
                        className={'char-row import-row' + (on ? ' picked' : '')}
                        onClick={() => it.id != null && toggle(it.id)}
                      >
                        <div className="char-meta">
                          <div className="char-name">{labelOf(it)}</div>
                        </div>
                        {on && <Check className="import-check" size={18} />}
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="editor-actions">
                <button className="primary" onClick={가져오기} disabled={busy || picked.size === 0}>
                  {busy ? <span className="spinner" /> : `${picked.size}개 ${UI.import}`}
                </button>
                <button onClick={onClose}>{UI.cancel}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
