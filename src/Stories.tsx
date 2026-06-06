import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { defaultStoryTitle } from './storyTitle';
import { confirmAsk, alertAsk } from './dialog';

type Story = { id: number; title: string; updated_at?: string };

export default function Stories({
  currentStoryId,
  onSwitch,
  onClose,
}: {
  currentStoryId: number | null;
  onSwitch: (id: number, title: string) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null); // 개칭 중인 장
  const [renameText, setRenameText] = useState('');

  async function load() {
    setLoading(true);
    try {
      const r = await fetch('/api/stories');
      const d = await r.json();
      setDbReady(!!d.dbReady);
      setErr(d.error || null);
      setList(Array.isArray(d.stories) ? d.stories : []);
    } catch (e) {
      setErr((e as Error).message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function 새이야기() {
    const r = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: defaultStoryTitle(list.length + 1) }),
    });
    const d = await r.json();
    if (!r.ok || d.error || !d.story) {
      await alertAsk({ message: '새 이야기를 펼치지 못했어요.', detail: d.error || undefined });
      return;
    }
    onSwitch(d.story.id, d.story.title); // 새 이야기로 전환
  }

  async function 복사(s: Story) {
    setCopyingId(s.id);
    try {
      const r = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ copy_from: s.id }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        await alertAsk({ message: '필사하지 못했어요.', detail: d.error || undefined });
        return;
      }
      await load();
    } finally {
      setCopyingId(null);
    }
  }

  function 개칭시작(s: Story) {
    setRenamingId(s.id);
    setRenameText(s.title);
  }

  async function 개칭저장(s: Story) {
    const t = renameText.trim();
    setRenamingId(null);
    if (!t || t === s.title) return; // 빈 이름·무변경이면 그대로 둔다
    const r = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: s.id, title: t }),
    });
    const d = await r.json();
    if (!r.ok || d.error) {
      await alertAsk({ message: '개칭하지 못했어요.', detail: d.error || undefined });
      return;
    }
    await load();
    if (s.id === currentStoryId && d.story) onSwitch(d.story.id, d.story.title); // 헤더 제목 갱신
  }

  async function 삭제(s: Story) {
    const yes = await confirmAsk({
      message: `「${s.title}」 이 기록을 소각하시겠습니까?`,
      detail: '소각된 기록은 다시 불러올 수 없습니다.',
      confirmLabel: '소각',
      danger: true,
    });
    if (!yes) return;
    const r = await fetch(`/api/stories?id=${s.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok || d.error) {
      await alertAsk({ message: '소각하지 못했어요.', detail: d.error || undefined });
      return;
    }
    // 목록 갱신 + 현재 이야기를 지웠으면 다른 이야기로 전환.
    const r2 = await fetch('/api/stories');
    const d2 = await r2.json();
    const fresh: Story[] = Array.isArray(d2.stories) ? d2.stories : [];
    setList(fresh);
    if (s.id === currentStoryId) {
      if (fresh.length > 0) {
        onSwitch(fresh[0].id, fresh[0].title);
      } else {
        const cr = await fetch('/api/stories', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: defaultStoryTitle(1) }),
        });
        const cd = await cr.json();
        if (cd.story) onSwitch(cd.story.id, cd.story.title);
      }
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>천각의 박동</h2>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>

        {!dbReady && (
          <p className="warn">Supabase가 연결되지 않아 이야기를 저장·관리할 수 없어요.</p>
        )}
        {dbReady && err && (
          <p className="warn">
            이야기 표가 아직 없는 것 같아요. 안내된 SQL을 Supabase에서 한 번 실행해 주세요.
            <br />
            <span className="dim">({err})</span>
          </p>
        )}

        <div className="modal-body">
          <p className="dim small">
            세이브처럼 이야기를 여러 개 두고 오갈 수 있어요. 저장은 자동이고, 현재 이야기에 쌓입니다.
            (인물·견문록은 모든 이야기가 공유해요.)
          </p>
          <button className="new" onClick={새이야기}>
            ＋ 새로운 운명의 장
          </button>
          {loading ? (
            <p className="dim">불러오는 중…</p>
          ) : list.length === 0 ? (
            <p className="dim">아직 이야기가 없어요.</p>
          ) : (
            <ul className="char-list">
              {list.map((s) =>
                renamingId === s.id ? (
                  <li key={s.id} className={'char-row' + (s.id === currentStoryId ? ' current' : '')}>
                    <input
                      className="rename-input"
                      value={renameText}
                      autoFocus
                      onChange={(e) => setRenameText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return; // 한글 조합 중 무시
                        if (e.key === 'Enter') 개칭저장(s);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                    />
                    <button className="rowbtn" title="새김" onClick={() => 개칭저장(s)}>
                      <Check size={15} />
                    </button>
                    <button className="rowbtn" title="물림" onClick={() => setRenamingId(null)}>
                      <X size={15} />
                    </button>
                  </li>
                ) : (
                  <li key={s.id} className={'char-row' + (s.id === currentStoryId ? ' current' : '')}>
                    <div className="char-meta clickable" onClick={() => onSwitch(s.id, s.title)}>
                      <div className="char-name">
                        {s.title}
                        {s.id === currentStoryId && <span className="tag">현재</span>}
                      </div>
                    </div>
                    <button className="rowbtn" onClick={() => 개칭시작(s)}>
                      개칭
                    </button>
                    <button
                      className="rowbtn"
                      onClick={() => 복사(s)}
                      disabled={copyingId === s.id}
                    >
                      {copyingId === s.id ? '필사 중…' : '필사'}
                    </button>
                    <button className="rowbtn danger" onClick={() => 삭제(s)}>
                      소각
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
