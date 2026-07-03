// API 사용 내역 — 천각의 박동(설정) 안 빌더 진단 패널. 서버가 모델별로 쌓은 토큰을 읽어 비용을 추정해 보인다.
//  ※ 빌더용 진단이라 기술어를 남겨둔다(CLAUDE.md §1 예외). 평소엔 접어둘 수 있다(숨기기).
import { useEffect, useState } from 'react';
import { 비용, 라벨, type Tally } from './pricing';
import { showToast } from './toast';
import { confirmAsk } from './dialog';

const HIDE_KEY = 'usageHidden';

export default function UsagePanel() {
  const [usage, setUsage] = useState<Record<string, Tally>>({});
  const [hidden, setHidden] = useState(() => localStorage.getItem(HIDE_KEY) === '1');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch('/api/stories?usage=1');
      const d = await r.json();
      setUsage(d?.usage && typeof d.usage === 'object' ? d.usage : {});
    } catch {
      /* 진단 패널이라 실패해도 앱엔 무해 — 조용히 둔다 */
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!hidden) load();
  }, [hidden]);

  function toggleHide() {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(HIDE_KEY, next ? '1' : '0');
  }

  async function reset() {
    const ok = await confirmAsk({
      message: 'API 사용 내역을 초기화하시겠습니까?',
      detail: '누적된 사용 기록을 모두 지웁니다. 되돌릴 수 없습니다.',
      confirmLabel: '초기화',
      danger: true,
    });
    if (!ok) return;
    try {
      await fetch('/api/stories?usage=1', { method: 'DELETE' });
      setUsage({});
      showToast('사용 기록을 초기화하였습니다.');
    } catch {
      showToast('사용 기록을 초기화하지 못했습니다.');
    }
  }

  if (hidden) {
    return (
      <div className="usage usage--collapsed">
        <button className="usage-toggle" onClick={toggleHide}>
          API 사용 내역 보기
        </button>
      </div>
    );
  }

  const models = Object.keys(usage).filter((m) => (usage[m]?.calls || 0) > 0);
  const total = models.reduce((s, m) => s + 비용(m, usage[m]), 0);

  return (
    <div className="usage">
      <div className="usage-head">
        <span className="usage-title">API 사용 내역</span>
        <button className="usage-toggle" onClick={toggleHide}>
          숨기기
        </button>
      </div>
      {loading ? (
        <div className="usage-empty">펼치는 중…</div>
      ) : models.length === 0 ? (
        <div className="usage-empty">아직 기록이 없습니다.</div>
      ) : (
        <>
          <ul className="usage-list">
            {models.map((m) => {
              const t = usage[m];
              return (
                <li key={m} className="usage-row">
                  <div className="usage-row-top">
                    <span className="usage-name">{라벨(m)}</span>
                    <span className="usage-cost">${비용(m, t).toFixed(4)}</span>
                  </div>
                  <div className="usage-meta">
                    {t.calls}회 · 입력 {t.in.toLocaleString()} / 출력 {t.out.toLocaleString()}
                  </div>
                </li>
              );
            })}
            <li className="usage-row usage-total">
              <div className="usage-row-top">
                <span className="usage-name">합계</span>
                <span className="usage-cost">${total.toFixed(4)}</span>
              </div>
            </li>
          </ul>
          <button className="usage-reset" onClick={reset}>
            기록 초기화
          </button>
        </>
      )}
    </div>
  );
}
