import { useState, useRef, useEffect } from 'react';
import Characters from './Characters';
import LorePanel from './Lore';
import Stories from './Stories';
import Menu, { type MenuItem } from './Menu';

type Turn = { role: 'user' | 'assistant'; content: string };
type Story = { id: number; title: string };

const LS_STORY = 'fe3h.currentStoryId';

// 본문 속 라틴(=포드라 문자: 서명·명문) 구간을 필기체(Pinyon Script)로 렌더.
function 포드라문자_렌더(text: string) {
  const parts = text.split(/([A-Za-z][A-Za-z '’\-]*[A-Za-z]|[A-Za-z])/g);
  return parts.map((p, i) =>
    /[A-Za-z]/.test(p) ? (
      <span key={i} className="script">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [storyId, setStoryId] = useState<number | null>(null);
  const [storyTitle, setStoryTitle] = useState('');
  const [showChars, setShowChars] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const [showStories, setShowStories] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const 끝 = useRef<HTMLDivElement>(null);

  // 드로어 메뉴 항목 — 늘릴 땐 여기 한 줄만 추가하면 됨.
  const menuItems: MenuItem[] = [
    { label: '이야기', hint: '세이브 전환·관리', onClick: () => setShowStories(true) },
    { label: '인물', hint: '캐릭터 프로필', onClick: () => setShowChars(true) },
    { label: '견문록', hint: '연재 고유 설정', onClick: () => setShowLore(true) },
  ];

  // 특정 이야기의 본문을 불러온다.
  async function loadTurnsFor(id: number | null) {
    try {
      const url = id ? `/api/turns?story_id=${id}` : '/api/turns';
      const r = await fetch(url);
      const d = await r.json();
      setTurns(Array.isArray(d?.turns) ? (d.turns as Turn[]) : []);
    } catch {
      setTurns([]);
    }
  }

  // 화면을 켜면 '현재 이야기'를 정하고(없으면 만들고) 그 본문을 복원한다.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/stories');
        const data = await res.json();
        if (!data.dbReady) {
          // Supabase 미설정 — 이야기 개념 없이 동작(휘발).
          loadTurnsFor(null);
          return;
        }
        const list: Story[] = Array.isArray(data.stories) ? data.stories : [];
        const saved = Number(localStorage.getItem(LS_STORY)) || null;
        let cur: Story | undefined = saved ? list.find((s) => s.id === saved) : undefined;
        if (!cur) cur = list[0];
        if (!cur) {
          // 하나도 없으면 기본 이야기 생성.
          const cr = await fetch('/api/stories', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title: '이야기 1' }),
          });
          const cd = await cr.json();
          cur = cd.story;
        }
        if (!alive || !cur) return;
        setStoryId(cur.id);
        setStoryTitle(cur.title);
        localStorage.setItem(LS_STORY, String(cur.id));
        loadTurnsFor(cur.id);
      } catch {
        /* 무시 — 빈 화면으로 시작 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 새 문장이 흘러나올 때마다 맨 아래로 따라간다.
  useEffect(() => {
    끝.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  // 이야기 전환(불러오기).
  function switchStory(id: number, title: string) {
    setStoryId(id);
    setStoryTitle(title);
    localStorage.setItem(LS_STORY, String(id));
    setTurns([]);
    loadTurnsFor(id);
    setShowStories(false);
  }

  async function 보내기() {
    const 입력 = input.trim();
    if (!입력 || busy) return;

    const 다음: Turn[] = [...turns, { role: 'user', content: 입력 }, { role: 'assistant', content: '' }];
    setTurns(다음);
    setInput('');
    setBusy(true);

    const messages = 다음.slice(0, -1).map((t) => ({ role: t.role, content: t.content }));

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, story_id: storyId }),
      });

      if (!res.ok || !res.body) {
        const 사유 = await res.text();
        붙이기(사유 || '[연결 오류]');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        붙이기(decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      붙이기(`\n\n[연결 오류] ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  function 붙이기(조각: string) {
    setTurns((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === 'assistant') {
        copy[copy.length - 1] = { ...last, content: last.content + 조각 };
      }
      return copy;
    });
  }

  return (
    <div className="page">
      <header className="head">
        <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="메뉴">
          ☰
        </button>
        <div className="title">
          <h1>풍화설월</h1>
          <p className="sub">{storyTitle || '— 기록되지 않은 이야기를 잇는 곳 —'}</p>
        </div>
      </header>

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        subtitle={storyTitle || undefined}
        items={menuItems}
      />

      {showStories && (
        <Stories currentStoryId={storyId} onSwitch={switchStory} onClose={() => setShowStories(false)} />
      )}
      {showChars && <Characters storyId={storyId} onClose={() => setShowChars(false)} />}
      {showLore && <LorePanel storyId={storyId} onClose={() => setShowLore(false)} />}

      <main className="scroll">
        {turns.length === 0 && (
          <p className="hint">
            첫 장면을 적어 이야기를 펼치세요. (예: “사관학교 새벽, 텅 빈 훈련장에 선 디미트리.”)
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'turn user' : 'turn story'}>
            {t.content
              ? t.role === 'assistant'
                ? 포드라문자_렌더(t.content)
                : t.content
              : busy && i === turns.length - 1
                ? <span className="dim">…집필 중…</span>
                : null}
          </div>
        ))}
        <div ref={끝} />
      </main>

      <footer className="compose">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) 보내기();
          }}
          placeholder="이야기를 이어 적으세요…  (Ctrl/⌘ + Enter 로 전송)"
          rows={3}
          disabled={busy}
        />
        <button onClick={보내기} disabled={busy || !input.trim()}>
          {busy ? '집필 중…' : '잇기'}
        </button>
      </footer>
    </div>
  );
}
