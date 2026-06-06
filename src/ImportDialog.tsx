import { useEffect, useState } from 'react';

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
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="dim small">
            다른 장에서 골라 <b>필사</b>해 들입니다. 들인 뒤 고쳐도 본래의 장은 그대로예요.
          </p>

          <label>
            <span className="dim small">어느 장에서?</span>
            <select
              value={sourceId ?? ''}
              onChange={(e) => pickStory(Number(e.target.value))}
              style={{
                width: '100%',
                marginTop: 4,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
              }}
            >
              <option value="" disabled>
                장 고르기…
              </option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>

          {sourceId != null && (
            <>
              {loading ? (
                <p className="dim">펼치는 중…</p>
              ) : items.length === 0 ? (
                <p className="dim">그 장엔 들일 것이 없어요.</p>
              ) : (
                <ul className="char-list" style={{ marginTop: 10 }}>
                  {items.map((it) => (
                    <li key={it.id} className="char-row" onClick={() => it.id != null && toggle(it.id)}>
                      <input
                        type="checkbox"
                        checked={it.id != null && picked.has(it.id)}
                        readOnly
                        style={{ marginRight: 4 }}
                      />
                      <div className="char-meta">
                        <div className="char-name">{labelOf(it)}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="editor-actions">
                <button className="primary" onClick={가져오기} disabled={busy || picked.size === 0}>
                  {busy ? '들이는 중…' : `${picked.size}개 들이기`}
                </button>
                <button onClick={onClose}>철회</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
