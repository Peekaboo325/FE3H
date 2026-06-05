import { useState, useRef, useEffect } from 'react';
import Characters from './Characters';
import LorePanel from './Lore';

type Turn = { role: 'user' | 'assistant'; content: string };

export default function App() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showChars, setShowChars] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const 끝 = useRef<HTMLDivElement>(null);

  // 화면을 켜면, 저장돼 있던 이야기를 불러와 복원한다.
  // (Supabase 미설정이면 빈 목록이 와서 새 이야기로 시작.)
  useEffect(() => {
    fetch('/api/turns')
      .then((r) => (r.ok ? r.json() : { turns: [] }))
      .then((d) => {
        if (Array.isArray(d?.turns) && d.turns.length > 0) setTurns(d.turns as Turn[]);
      })
      .catch(() => {});
  }, []);

  // 새 문장이 흘러나올 때마다 맨 아래로 따라간다.
  useEffect(() => {
    끝.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, busy]);

  async function 보내기() {
    const 입력 = input.trim();
    if (!입력 || busy) return;

    // 유저 입력 + 비어 있는 서술자 칸을 먼저 띄운다(곧 채워진다).
    const 다음: Turn[] = [...turns, { role: 'user', content: 입력 }, { role: 'assistant', content: '' }];
    setTurns(다음);
    setInput('');
    setBusy(true);

    // 서버로 보낼 대화 기록(빈 서술자 칸은 제외).
    const messages = 다음.slice(0, -1).map((t) => ({ role: t.role, content: t.content }));

    try {
      const res = await fetch('/api/story', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages }),
      });

      if (!res.ok || !res.body) {
        const 사유 = await res.text();
        붙이기(사유 || '[연결 오류]');
        return;
      }

      // 스트리밍으로 들어오는 문장 조각을 마지막 칸에 이어 붙인다.
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

  // 마지막(서술자) 칸에 텍스트를 이어 붙인다.
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
        <div className="nav-group">
          <button className="nav" onClick={() => setShowChars(true)}>
            인물
          </button>
          <button className="nav" onClick={() => setShowLore(true)}>
            견문록
          </button>
        </div>
        <div className="title">
          <h1>풍화설월</h1>
          <p className="sub">— 기록되지 않은 이야기를 잇는 곳 —</p>
        </div>
      </header>

      {showChars && <Characters onClose={() => setShowChars(false)} />}
      {showLore && <LorePanel onClose={() => setShowLore(false)} />}

      <main className="scroll">
        {turns.length === 0 && (
          <p className="hint">
            첫 장면을 적어 이야기를 펼치세요. (예: “사관학교 새벽, 텅 빈 훈련장에 선 디미트리.”)
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === 'user' ? 'turn user' : 'turn story'}>
            {t.content || (busy && i === turns.length - 1 ? <span className="dim">…집필 중…</span> : null)}
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
