import { useEffect, useState } from 'react';
import Dropdown from './Dropdown';
import { Check, X } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
import ListRow from './ListRow';
import Spinner from './Spinner';

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
  subOf,
  imageOf,
  fxOf,
  omit,
  noun = '항목',
  onClose,
  onDone,
}: {
  title: string;
  endpoint: string; // '/api/characters' | '/api/lore'
  itemsKey: string; // 'characters' | 'lore'
  payloadKey: string; // 'character' | 'entry'
  currentStoryId: number;
  labelOf: (it: T) => string;
  subOf?: (it: T) => string | undefined; // 부가(이명/분류 등)
  imageOf?: (it: T) => string | undefined; // 초상(전체 이미지) — 인물 전용
  fxOf?: (it: T) => string | undefined; // 상태 효과 클래스
  omit?: string[]; // 반입에서 제외할 칸(예: 보고서·상태 — 유저가 '작성'한 것만 가져오기)
  noun?: string; // 빈 안내용 명사(인물/문헌)
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
        for (const k of omit || []) delete copy[k]; // 유저가 '작성'한 것만 — 보고서·상태 등 제외
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
      <div className="modal modal--import" onClick={(e) => e.stopPropagation()}>
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
              <div className="import-scroll">
                {loading ? (
                  <Spinner />
                ) : items.length === 0 ? (
                  <p className="list-empty">반입할 수 있는 {noun}이 없습니다.</p>
                ) : (
                  <ul className="list-rows">
                    {items.map((it) => {
                      const on = it.id != null && picked.has(it.id);
                      return (
                        <ListRow
                          key={it.id}
                          image={imageOf?.(it)}
                          name={labelOf(it)}
                          sub={subOf?.(it)}
                          fx={fxOf?.(it)}
                          selected={on}
                          right={on ? <Check size={18} /> : null}
                          onClick={() => it.id != null && toggle(it.id)}
                        />
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="editor-actions">
                <button onClick={onClose}>{UI.cancel}</button>
                <button className="primary" onClick={가져오기} disabled={busy || picked.size === 0}>
                  {busy ? <span className="spinner" /> : `${picked.size}개 ${UI.import}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
