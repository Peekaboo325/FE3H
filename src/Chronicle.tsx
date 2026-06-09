import { useEffect, useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
import Button from './Button';
import Spinner from './Spinner';

type Entry = { id: number | null; ep: number; title: string; summary: string | null };

// 연대 문헌 — 화별 줄거리(왕실 사관의 기록).
//  목록(미리보기) → 항목 클릭 시 상세 뷰. 상세에서 '그 화로 가기'로 본문의 그 화로 이동.
export default function Chronicle({
  storyId,
  onClose,
  onJump,
}: {
  storyId: number | null;
  onClose: () => void;
  onJump?: (turnId: number) => void;
}) {
  const [list, setList] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [dbOk, setDbOk] = useState(true);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [redoing, setRedoing] = useState(false); // '다시 기록' 진행 중

  // 그 화를 다시 요약해 갈무리한다(잘린 요약·갱신 대응).
  const 다시기록 = async () => {
    if (selected?.id == null) return;
    setRedoing(true);
    try {
      const r = await fetch('/api/chronicle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn_id: selected.id }),
      });
      const d = await r.json();
      if (d.ok && typeof d.summary === 'string') {
        setSelected({ ...selected, summary: d.summary });
        setList((prev) => prev.map((e) => (e.id === selected.id ? { ...e, summary: d.summary } : e)));
      } else {
        alert(d.error || '다시 적지 못했습니다.');
      }
    } catch {
      alert('다시 적지 못했습니다.');
    }
    setRedoing(false);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/chronicle?story_id=${storyId ?? ''}`);
        const d = await r.json();
        if (!alive) return;
        setDbOk(!!d.dbReady);
        setReady(!!d.ready);
        setList(Array.isArray(d.chronicle) ? d.chronicle : []);
      } catch {
        /* 무시 */
      }
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [storyId]);

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal modal--chronicle" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {selected ? (
            <div className="modal-head-l">
              <IconButton label="뒤로" onClick={() => setSelected(null)}>
                <ArrowLeft size={17} />
              </IconButton>
              <h2>연대 문헌</h2>
            </div>
          ) : (
            <h2>연대 문헌</h2>
          )}
          <IconButton label={UI.close} onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>

        {!dbOk && <p className="warn">기록의 샘이 닿지 않아 연대 문헌을 펼칠 수 없습니다.</p>}
        {dbOk && !ready && (
          <p className="warn">
            연대 문헌을 담을 자리가 아직 없습니다. 안내된 SQL을 Supabase에서 한 번 실행하십시오.
          </p>
        )}

        <div className="modal-body">
          {loading ? (
            <Spinner />
          ) : selected ? (
            <div className="chronicle-view">
              <h3 className="chronicle-view-title">{selected.title}</h3>
              {selected.summary ? (
                <div className="chronicle-view-body">{selected.summary}</div>
              ) : (
                <p className="dim small">아직 기록되지 않은 장입니다.</p>
              )}
              {selected.id != null && (
                <div className="chronicle-view-foot">
                  <Button loading={redoing} onClick={다시기록}>
                    {UI.regen}
                  </Button>
                  {onJump && <Button onClick={() => onJump(selected.id as number)}>이동</Button>}
                </div>
              )}
            </div>
          ) : list.length === 0 ? (
            <p className="list-empty">아직 기록된 장이 없습니다.</p>
          ) : (
            <ul className="chronicle-list">
              {list.map((e) => (
                <li key={e.id ?? e.ep}>
                  <button className="chronicle-row" onClick={() => setSelected(e)}>
                    <div className="chronicle-title">{e.title}</div>
                    {e.summary ? (
                      <div className="chronicle-summary clamp2">{e.summary}</div>
                    ) : (
                      <div className="dim small">아직 기록되지 않은 장입니다.</div>
                    )}
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
