import { useEffect, useState } from 'react';
import { X, ArrowLeft, BookOpen } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
              {selected.id != null && onJump && (
                <div className="chronicle-view-foot">
                  <button className="chronicle-jump" onClick={() => onJump(selected.id as number)}>
                    <BookOpen size={15} />
                    그 화로 가기
                  </button>
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
