import { useState, useEffect } from 'react';
import { 이미지를_썸네일로 } from './imageUtils';
import { alertAsk } from './dialog';
import { useCharacters, type Character } from './useCharacters';
import ImportDialog from './ImportDialog';

const 빈인물 = (): Character => ({
  name: '',
  english_name: '',
  aliases: '',
  faction: '',
  title: '',
  appearance: '',
  personality: '',
  combat: '',
  notes: '',
  life_status: 'alive',
  is_active: true,
  thumbnail: '',
});

export default function Characters({
  storyId,
  onClose,
}: {
  storyId: number | null;
  onClose: () => void;
}) {
  // 현재 이야기의 인물만 본다(이야기별 분리).
  const { chars, loading, dbReady, err, refresh } = useCharacters(storyId);
  const [editing, setEditing] = useState<Character | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [armed, setArmed] = useState(false); // 삭제 두 번 누르기: 첫 클릭=활성, 둘째=실행
  useEffect(() => setArmed(false), [editing]); // 다른 인물로 옮기거나 닫으면 해제

  function set<K extends keyof Character>(k: K, v: Character[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !editing) return;
    try {
      const thumb = await 이미지를_썸네일로(f);
      set('thumbnail', thumb);
    } catch (err) {
      await alertAsk({ message: '초상을 올리지 못했어요.', detail: (err as Error).message });
    }
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      await alertAsk({ message: '이름은 꼭 필요해요.' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character: { ...editing, story_id: storyId } }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        await alertAsk({ message: '기록하지 못했어요.', detail: data.error || '알 수 없는 까닭' });
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
    const res = await fetch(`/api/characters?id=${editing.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) {
      await alertAsk({ message: '지우지 못했어요.', detail: data.error || undefined });
      return;
    }
    await refresh();
    setEditing(null);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{editing ? (editing.id ? '인물 편집' : '새 인물') : '인물'}</h2>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 안내: Supabase/표 상태 */}
        {!dbReady && (
          <p className="warn">아직 기록의 샘이 닿지 않아 인물을 기록할 수 없어요.</p>
        )}
        {dbReady && err && (
          <p className="warn">
            인물 표가 아직 없는 것 같아요. 안내된 SQL을 Supabase에서 한 번 실행해 주세요.
            <br />
            <span className="dim">({err})</span>
          </p>
        )}

        {storyId == null && <p className="warn">이야기를 먼저 만들어 주세요.</p>}

        {/* 목록 화면 */}
        {!editing && (
          <div className="modal-body">
            <button className="new" onClick={() => setEditing(빈인물())}>
              ＋ 새 인물
            </button>
            {storyId != null && (
              <button className="new" onClick={() => setImporting(true)}>
                ↧ 다른 장에서 반입
              </button>
            )}
            {loading ? (
              <p className="dim">펼치는 중…</p>
            ) : chars.length === 0 ? (
              <p className="dim">아직 기록된 인물이 없어요.</p>
            ) : (
              <ul className="char-list">
                {chars.map((c) => (
                  <li key={c.id} className="char-row" onClick={() => setEditing(c)}>
                    {c.thumbnail ? (
                      <img className="thumb" src={c.thumbnail} alt="" />
                    ) : (
                      <div className="thumb empty">{c.name.slice(0, 1)}</div>
                    )}
                    <div className="char-meta">
                      <div className="char-name">
                        {c.name}
                        {c.life_status === 'deceased' && <span className="tag">故</span>}
                        {c.is_active === false && <span className="tag dimtag">잠듦</span>}
                      </div>
                      <div className="char-sub">{c.title || c.faction || ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 편집 화면 */}
        {editing && (
          <div className="modal-body editor">
            <div className="thumb-edit">
              {editing.thumbnail ? (
                <img className="thumb big" src={editing.thumbnail} alt="" />
              ) : (
                <div className="thumb big empty">초상화</div>
              )}
              <label className="filebtn">
                초상 올리기
                <input type="file" accept="image/*" onChange={onPickImage} hidden />
              </label>
              {editing.thumbnail && (
                <button className="link" onClick={() => set('thumbnail', '')}>
                  지우기
                </button>
              )}
              <p className="dim small">600px·WebP로 자동 변환됩니다.</p>
            </div>

            <div className="row2">
              <label>
                이름 *
                <input value={editing.name} onChange={(e) => set('name', e.target.value)} />
              </label>
              <label>
                영문명
                <input
                  value={editing.english_name || ''}
                  onChange={(e) => set('english_name', e.target.value)}
                />
              </label>
            </div>

            <label>
              이명 (여럿이면 쉼표로)
              <input value={editing.aliases || ''} onChange={(e) => set('aliases', e.target.value)} />
            </label>

            <div className="row2">
              <label>
                소속
                <input
                  value={editing.faction || ''}
                  onChange={(e) => set('faction', e.target.value)}
                  placeholder="예: 퍼거스 신성 왕국"
                />
              </label>
              <label>
                한 줄 정의
                <input
                  value={editing.title || ''}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="예: 신성 왕국의 왕세자"
                />
              </label>
            </div>

            <label>
              외양
              <textarea
                rows={2}
                value={editing.appearance || ''}
                onChange={(e) => set('appearance', e.target.value)}
                placeholder="머리·눈·체격 등"
              />
            </label>
            <label>
              성격·내면
              <textarea
                rows={3}
                value={editing.personality || ''}
                onChange={(e) => set('personality', e.target.value)}
                placeholder="외면 성격, 내면, 특징…"
              />
            </label>
            <label>
              무기·전투
              <textarea
                rows={2}
                value={editing.combat || ''}
                onChange={(e) => set('combat', e.target.value)}
                placeholder="주무기, 병종, 영웅의 유산·문장…"
              />
            </label>
            <label>
              비고
              <textarea
                rows={2}
                value={editing.notes || ''}
                onChange={(e) => set('notes', e.target.value)}
              />
            </label>

            <div className="row2">
              <label>
                생사
                <select
                  value={editing.life_status || 'alive'}
                  onChange={(e) => set('life_status', e.target.value as Character['life_status'])}
                >
                  <option value="alive">생존</option>
                  <option value="deceased">사망</option>
                  <option value="unknown">불명</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={editing.is_active !== false}
                  onChange={(e) => set('is_active', e.target.checked)}
                />
                활성 (지금 이야기에 등장)
              </label>
            </div>

            <div className="editor-actions">
              <button className="primary" onClick={save} disabled={saving}>
                {saving ? '기록하는 중…' : '기록'}
              </button>
              <button onClick={() => setEditing(null)}>취소</button>
              {editing.id && (
                <button
                  className={'danger' + (armed ? ' armed' : '')}
                  onClick={() => (armed ? remove() : setArmed(true))}
                >
                  소각
                </button>
              )}
            </div>
          </div>
        )}

        {importing && storyId != null && (
          <ImportDialog<Character>
            title="인물 반입"
            endpoint="/api/characters"
            itemsKey="characters"
            payloadKey="character"
            currentStoryId={storyId}
            labelOf={(c) => c.name}
            onClose={() => setImporting(false)}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}
