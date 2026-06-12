// 서신 탭 — 수신함 / 발신함 / 보관함. 설계 전체 = docs/서신_설계.md.
//  · 한 통 = letters 표 한 행. 새로고침 1회 = 편지 1통(답장 우선 → 유서 → 신규).
//  · 봉인(is_sealed) = 아직 안 읽음 — 열람하는 순간 개봉.
//  · 보관함 = 발신자가 차마 부치지 못한 편지(draft). 열람·소각만 가능, 부치기 없음.
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Feather, Pencil, Trash2 } from 'lucide-react';
import { UI } from './strings';
import { showToast } from './toast';
import { confirmAsk } from './dialog';
import IconButton from './IconButton';
import Button from './Button';
import Spinner from './Spinner';
import Markdown from './Markdown';
import { firstName } from './nameUtils';

export type Letter = {
  id: number;
  story_id: number | null;
  sender_id: number | null;
  receiver_id: number | null;
  sender_name: string;
  recipient_name: string;
  type: string;
  status: 'sent' | 'draft';
  title: string;
  content: string;
  signature: string;
  reply_to_id: number | null;
  is_sealed: boolean;
  created_at?: string;
};

type Box = 'in' | 'out' | 'drafts';
const 함목록: { key: Box; label: string }[] = [
  { key: 'in', label: UI.inbox },
  { key: 'out', label: UI.outbox },
  { key: 'drafts', label: UI.drafts },
];

// 서신 유형의 화면 표기(목록·상세의 작은 칩).
const 유형표기: Record<string, string> = {
  letter: '서신',
  note: '쪽지',
  official: '공문',
  invitation: '초대장',
  petition: '탄원',
  warning: '경고장',
  will: '유서',
};

// 서명 표시 — 라틴(영문 이름)만 흘림체(.script)로. "왕세자 Dimitri" → 한글은 정자, 이름은 흘림.
function SignatureText({ text }: { text: string }) {
  const parts = (text ?? '').split(/([A-Za-z][A-Za-z .'’-]*[A-Za-z.]|[A-Za-z])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^[A-Za-z]/.test(p) ? (
          <span key={i} className="script sig-name">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

// 목록 행에 보일 상대 이름 — 등록 인물(id 있음)은 퍼스트네임, 子·모브는 적힌 그대로.
function 상대표기(name: string, hasId: boolean) {
  return hasId ? firstName(name) : name || '?';
}

export default function LettersTab({
  ownerId,
  storyId,
}: {
  ownerId: number;
  storyId: number | null;
}) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [box, setBox] = useState<Box>('in');
  const [sel, setSel] = useState<Letter | null>(null);
  const [fetching, setFetching] = useState(false); // 새 서신 생성 중
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', signature: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/letters?story_id=${storyId ?? ''}&character_id=${ownerId}`);
      const data = await res.json();
      setLetters(Array.isArray(data.letters) ? data.letters : []);
    } catch {
      setLetters([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId, storyId]);

  useEffect(() => {
    setLoading(true);
    setSel(null);
    setEditing(false);
    setBox('in');
    load();
  }, [load]);

  // 함별 분류 — 한 통이 양쪽 함(보낸 이의 발신함·받은 이의 수신함)에서 보이는 구조.
  const 분류 = (b: Box) =>
    letters.filter((l) => {
      if (b === 'in') return l.receiver_id === ownerId && l.status === 'sent';
      if (b === 'out') return l.sender_id === ownerId && l.status === 'sent';
      return l.sender_id === ownerId && l.status === 'draft';
    });
  const 현재함 = 분류(box);

  // 새 서신 — 교환소를 한 번 돌린다(답장 우선 → 유서 → 신규 발신).
  async function 확인() {
    if (fetching) return;
    setFetching(true);
    try {
      const res = await fetch('/api/letters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character_id: ownerId, story_id: storyId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(typeof data.error === 'string' && data.error.length < 60 ? data.error : '서신을 받지 못했습니다.');
        return;
      }
      await load();
      if (data.kind === 'will') showToast('유품에서 서신 한 통이 발견되었습니다.');
      else if (data.kind === 'draft') showToast('부치지 못한 서신이 보관함에 남았습니다.');
      else showToast('새 서신이 당도했습니다.');
      if (data.kind === 'draft') setBox('drafts');
      else setBox(data.added?.[0]?.receiver_id === ownerId ? 'in' : 'out');
    } catch {
      showToast('서신을 받지 못했습니다.');
    } finally {
      setFetching(false);
    }
  }

  // 열람 — 봉인된 편지는 여는 순간 개봉(읽음).
  function 열람(l: Letter) {
    setSel(l);
    setEditing(false);
    if (l.is_sealed) {
      setLetters((prev) => prev.map((x) => (x.id === l.id ? { ...x, is_sealed: false } : x)));
      fetch('/api/letters', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: l.id, unseal: true }),
      }).catch(() => {});
    }
  }

  async function 소각(l: Letter) {
    const ok = await confirmAsk({
      message: `이 서신을 ${UI.erase}하시겠습니까?`,
      detail: '소각한 서신은 되찾을 수 없습니다.',
      confirmLabel: UI.erase,
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/letters?id=${l.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(`서신을 ${UI.erase}하지 못했습니다.`);
        return;
      }
      setLetters((prev) => prev.filter((x) => x.id !== l.id));
      setSel(null);
    } catch {
      showToast(`서신을 ${UI.erase}하지 못했습니다.`);
    }
  }

  async function 기록() {
    if (!sel || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/letters', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: sel.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast('서신을 기록하지 못했습니다.');
        return;
      }
      const next = { ...sel, ...form };
      setSel(next);
      setLetters((prev) => prev.map((x) => (x.id === sel.id ? next : x)));
      setEditing(false);
    } catch {
      showToast('서신을 기록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  // ── 상세(한 통 펼침) ──
  if (sel) {
    const incoming = sel.receiver_id === ownerId;
    return (
      <div className="letter-view">
        <div className="letter-toolbar">
          <IconButton label="목록" onClick={() => { setSel(null); setEditing(false); }}>
            <ArrowLeft size={17} />
          </IconButton>
          <div className="letter-tool-right">
            {!editing && (
              <IconButton
                label={UI.edit}
                onClick={() => {
                  setForm({ title: sel.title, content: sel.content, signature: sel.signature });
                  setEditing(true);
                }}
              >
                <Pencil size={15} />
              </IconButton>
            )}
            <IconButton label={UI.erase} onClick={() => 소각(sel)}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>

        <div className="letter-paper">
          {editing ? (
            <input
              className="letter-title-input"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          ) : (
            <h3 className="letter-title">{sel.title}</h3>
          )}
          <div className="letter-meta">
            <span className="letter-type-chip">{유형표기[sel.type] || '서신'}</span>
            <span>
              {incoming ? '발신' : '수신'} ·{' '}
              {incoming ? sel.sender_name : sel.recipient_name}
            </span>
          </div>
          <div className="letter-body">
            {editing ? (
              <textarea
                className="letter-body-input"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            ) : (
              <Markdown text={sel.content} />
            )}
          </div>
          <div className="letter-sig">
            {editing ? (
              <input
                className="letter-sig-input"
                value={form.signature}
                onChange={(e) => setForm((f) => ({ ...f, signature: e.target.value }))}
              />
            ) : (
              <SignatureText text={sel.signature} />
            )}
          </div>
          {editing && (
            <div className="letter-edit-actions">
              <Button variant="secondary" onClick={() => setEditing(false)}>
                {UI.cancel}
              </Button>
              <Button variant="primary" loading={saving} onClick={기록}>
                {UI.save}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 목록 ──
  return (
    <div className="letters-tab">
      <div className="letter-boxes">
        {함목록.map((b) => (
          <button
            key={b.key}
            className={'letter-box-btn' + (box === b.key ? ' on' : '')}
            onClick={() => setBox(b.key)}
          >
            {b.label}
            {b.key === 'in' && 분류('in').some((l) => l.is_sealed) && <span className="letter-dot" />}
          </button>
        ))}
      </div>

      {현재함.length === 0 ? (
        <p className="list-empty">
          {box === 'in'
            ? '도착한 서신이 없습니다.'
            : box === 'out'
              ? '보낸 서신이 없습니다.'
              : '보관함이 비어 있습니다.'}
        </p>
      ) : (
        <ul className="letter-list">
          {현재함.map((l) => {
            const incoming = l.receiver_id === ownerId;
            const peer = incoming
              ? 상대표기(l.sender_name, !!l.sender_id)
              : 상대표기(l.recipient_name, !!l.receiver_id);
            return (
              <li key={l.id}>
                <button className="letter-row" onClick={() => 열람(l)}>
                  {l.is_sealed ? (
                    <span className="letter-seal">봉인</span>
                  ) : (
                    <span className="letter-type-chip">{유형표기[l.type] || '서신'}</span>
                  )}
                  <span className="letter-row-title">{l.title}</span>
                  <span className="letter-row-peer">{peer}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="report-foot">
        <IconButton label="서신 확인" onClick={확인} disabled={fetching}>
          {fetching ? <span className="spinner" /> : <Feather size={17} />}
        </IconButton>
      </div>
    </div>
  );
}
