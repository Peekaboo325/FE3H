import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { UI } from './strings';
import IconButton from './IconButton';
import Spinner from './Spinner';

type Entry ={ id: number | null; ep: number; title: string; summary: string | null };

// 연대 문헌 — 화별 줄거리(왕실 사관의 기록)를 읽는 패널. 읽기 전용.
export default function Chronicle({
  storyId,
  onClose,
}: {
  storyId: number | null;
  onClose: () => void;
}) {
  const [list, setList] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [dbOk, setDbOk] = useState(true);

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
          <h2>연대 문헌</h2>
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
          ) : list.length === 0 ? (
            <p className="list-empty">아직 기록된 장이 없습니다.</p>
          ) : (
            <ul className="chronicle-list">
              {list.map((e) => (
                <li key={e.id ?? e.ep} className="chronicle-row">
                  <div className="chronicle-title">{e.title}</div>
                  {e.summary ? (
                    <div className="chronicle-summary">{e.summary}</div>
                  ) : (
                    <div className="dim small">아직 기록되지 않은 장입니다.</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
