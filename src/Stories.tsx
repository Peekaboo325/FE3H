import { useEffect, useState } from 'react';

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
      body: JSON.stringify({ title: `이야기 ${list.length + 1}` }),
    });
    const d = await r.json();
    if (!r.ok || d.error || !d.story) {
      alert('새 이야기 실패: ' + (d.error || ''));
      return;
    }
    onSwitch(d.story.id, d.story.title); // 새 이야기로 전환
  }

  async function 이름바꾸기(s: Story) {
    const t = prompt('이야기 제목', s.title);
    if (t == null) return;
    const r = await fetch('/api/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: s.id, title: t }),
    });
    const d = await r.json();
    if (!r.ok || d.error) {
      alert('이름 변경 실패: ' + (d.error || ''));
      return;
    }
    await load();
    if (s.id === currentStoryId && d.story) onSwitch(d.story.id, d.story.title); // 헤더 제목 갱신
  }

  async function 삭제(s: Story) {
    if (!confirm(`'${s.title}'을(를) 삭제할까요?\n이 이야기의 본문도 함께 사라져요.`)) return;
    const r = await fetch(`/api/stories?id=${s.id}`, { method: 'DELETE' });
    const d = await r.json();
    if (!r.ok || d.error) {
      alert('삭제 실패: ' + (d.error || ''));
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
          body: JSON.stringify({ title: '이야기 1' }),
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
          <h2>이야기</h2>
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
            ＋ 새 이야기
          </button>
          {loading ? (
            <p className="dim">불러오는 중…</p>
          ) : list.length === 0 ? (
            <p className="dim">아직 이야기가 없어요.</p>
          ) : (
            <ul className="char-list">
              {list.map((s) => (
                <li key={s.id} className={'char-row' + (s.id === currentStoryId ? ' current' : '')}>
                  <div className="char-meta clickable" onClick={() => onSwitch(s.id, s.title)}>
                    <div className="char-name">
                      {s.title}
                      {s.id === currentStoryId && <span className="tag">현재</span>}
                    </div>
                  </div>
                  <button className="rowbtn" onClick={() => 이름바꾸기(s)}>
                    이름
                  </button>
                  <button className="rowbtn danger" onClick={() => 삭제(s)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
