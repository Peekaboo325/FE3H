import { useState, useEffect } from 'react';
import { useLore, type Lore } from './useLore';
import { alertAsk } from './dialog';
import ImportDialog from './ImportDialog';
import { X, Trash2 } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';

const 빈설정 = (): Lore => ({ title: '', category: '', body: '', is_active: true });

export default function LorePanel({
  storyId,
  onClose,
}: {
  storyId: number | null;
  onClose: () => void;
}) {
  const { entries, loading, dbReady, err, refresh } = useLore(storyId);
  const [editing, setEditing] = useState<Lore | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [armed, setArmed] = useState(false); // 삭제 두 번 누르기: 첫 클릭=활성, 둘째=실행
  useEffect(() => setArmed(false), [editing]); // 다른 기록으로 옮기거나 닫으면 해제

  function set<K extends keyof Lore>(k: K, v: Lore[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!editing) return;
    if (!editing.title.trim()) {
      await alertAsk({ message: '제목은 꼭 필요합니다.' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entry: { ...editing, story_id: storyId } }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        await alertAsk({ message: `${UI.save}하지 못했습니다.`, detail: data.error || '알 수 없는 까닭' });
        return;
      }
      await refresh();
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!editing.id) {
      setEditing(null);
      return;
    }
    const res = await fetch(`/api/lore?id=${editing.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) {
      await alertAsk({ message: `${UI.erase}하지 못했습니다.`, detail: data.error || undefined });
      return;
    }
    await refresh();
    setEditing(null);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? (editing.id ? `문헌 ${UI.edit}` : '새 문헌') : '대륙 문헌'}</h2>
          <IconButton label={UI.close} onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>

        {!dbReady && (
          <p className="warn">아직 기록의 샘이 닿지 않아 문헌을 기록할 수 없습니다.</p>
        )}
        {dbReady && err && (
          <p className="warn">
            문헌 표가 아직 없는 듯합니다. 안내된 SQL을 Supabase에서 한 번 실행하십시오.
            <br />
            <span className="dim">({err})</span>
          </p>
        )}
        {storyId == null && <p className="warn">먼저 운명의 장을 펼치십시오.</p>}

        {!editing && (
          <div className="modal-body">
            <p className="dim small">
              원작에서 바꾸거나 새로 정한 세계의 결을 적어둡니다. 깨어 있는 문헌만 이야기에 깃듭니다.
            </p>
            <button className="new" onClick={() => setEditing(빈설정())}>
              ＋ 새 문헌
            </button>
            {storyId != null && (
              <button className="new" onClick={() => setImporting(true)}>
                ↧ 다른 장에서 {UI.import}
              </button>
            )}
            {loading ? (
              <p className="dim">펼치는 중…</p>
            ) : entries.length === 0 ? (
              <p className="dim">아직 기록된 문헌이 없습니다.</p>
            ) : (
              <ul className="char-list">
                {entries.map((e, i) => (
                  <li key={e.id} className="char-row" onClick={() => setEditing(e)}>
                    <div className="char-meta">
                      <div className="char-name">
                        <span className="ep-no jang">제{i + 1}권</span>
                        {e.title}
                        {e.category && <span className="tag">{e.category}</span>}
                        {e.is_active === false && <span className="tag dimtag">잠듦</span>}
                      </div>
                      <div className="char-sub">{(e.body || '').slice(0, 40)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {editing && (
          <div className="modal-body editor">
            <div className="row2">
              <label>
                제목 *
                <input
                  value={editing.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="예: 퍼거스 신성 왕국"
                />
              </label>
              <label>
                분류
                <input
                  value={editing.category || ''}
                  onChange={(e) => set('category', e.target.value)}
                  placeholder="예: 세력 / 지역 / 제도"
                />
              </label>
            </div>

            <label>
              내용
              <textarea
                rows={8}
                value={editing.body || ''}
                onChange={(e) => set('body', e.target.value)}
                placeholder="원작과 달라진 결, 새로 정한 이치를 적으십시오…"
              />
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={editing.is_active !== false}
                onChange={(e) => set('is_active', e.target.checked)}
              />
              활성 (지금 이야기에 반영)
            </label>

            <div className="editor-actions">
              {editing.id && (
                <button
                  className={'btn-erase' + (armed ? ' armed' : '')}
                  onClick={() => (armed ? remove() : setArmed(true))}
                  title={UI.erase}
                  aria-label={UI.erase}
                >
                  <Trash2 size={18} />
                </button>
              )}
              <div className="editor-actions-end">
                <button onClick={() => setEditing(null)}>{UI.cancel}</button>
                <button className="primary" onClick={save} disabled={saving}>
                  {saving ? `${UI.save}하는 중…` : UI.save}
                </button>
              </div>
            </div>
          </div>
        )}

        {importing && storyId != null && (
          <ImportDialog<Lore>
            title={`문헌 ${UI.import}`}
            endpoint="/api/lore"
            itemsKey="lore"
            payloadKey="entry"
            currentStoryId={storyId}
            labelOf={(e) => e.title}
            subOf={(e) => e.category || undefined}
            onClose={() => setImporting(false)}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}
