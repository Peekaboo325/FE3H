import { useState } from 'react';
import { useLore, type Lore } from './useLore';

const 빈설정 = (): Lore => ({ title: '', category: '', body: '', is_active: true });

export default function LorePanel({ onClose }: { onClose: () => void }) {
  const { entries, loading, dbReady, err, refresh } = useLore();
  const [editing, setEditing] = useState<Lore | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Lore>(k: K, v: Lore[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!editing) return;
    if (!editing.title.trim()) {
      alert('제목은 꼭 필요해요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/lore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entry: editing }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert('저장 실패: ' + (data.error || '알 수 없는 오류'));
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
    if (!confirm(`'${editing.title}' 설정을 삭제할까요?`)) return;
    const res = await fetch(`/api/lore?id=${editing.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) {
      alert('삭제 실패: ' + (data.error || ''));
      return;
    }
    await refresh();
    setEditing(null);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? (editing.id ? '설정 고치기' : '새 설정') : '견문록'}</h2>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>

        {!dbReady && (
          <p className="warn">아직 Supabase가 연결되지 않아 설정을 저장할 수 없어요.</p>
        )}
        {dbReady && err && (
          <p className="warn">
            견문록 표가 아직 없는 것 같아요. 안내된 SQL을 Supabase에서 한 번 실행해 주세요.
            <br />
            <span className="dim">({err})</span>
          </p>
        )}

        {!editing && (
          <div className="modal-body">
            <p className="dim small">
              원작에서 바꾸거나 새로 정한 세계 설정을 적어두세요. 활성인 설정만 이야기에 반영됩니다.
            </p>
            <button className="new" onClick={() => setEditing(빈설정())}>
              ＋ 새 설정
            </button>
            {loading ? (
              <p className="dim">불러오는 중…</p>
            ) : entries.length === 0 ? (
              <p className="dim">아직 등록된 설정이 없어요.</p>
            ) : (
              <ul className="char-list">
                {entries.map((e) => (
                  <li key={e.id} className="char-row" onClick={() => setEditing(e)}>
                    <div className="char-meta">
                      <div className="char-name">
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
                placeholder="원작과 달라진 점, 새로 정한 설정을 적으세요…"
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
              <button className="primary" onClick={save} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </button>
              <button onClick={() => setEditing(null)}>취소</button>
              {editing.id && (
                <button className="danger" onClick={remove}>
                  삭제
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
