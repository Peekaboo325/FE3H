import { useEffect, useState } from 'react';

// 답변을 준비하는 동안의 디제틱 문구 — 점 3개와 함께 페이드로 교체된다.
const 일반문구 = [
  '포드라의 정세를 살피는 중…',
  '서사의 실타래를 엮는 중…',
  '여신의 시선이 다음 순간에 머뭅니다…',
  '운명의 궤적이 움직이기 시작합니다…',
  '깃펜이 양피지를 스칩니다…',
];

// 앵커(회차·문헌 되짚기)가 걸렸을 때 — 기억을 더듬는 톤.
const 회상문구 = [
  '잠든 기억의 페이지를 들추는 중…',
  '지나간 장의 목소리를 불러옵니다…',
  '천각의 박동이 시간의 틈을 더듬습니다…',
  '옛 기록이 지금의 장면에 닿습니다…',
];

export default function LoadingIndicator({ recall = false }: { recall?: boolean }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const pool = recall ? 회상문구 : 일반문구;
    setI(0);
    const id = setInterval(() => setI((x) => (x + 1) % pool.length), 4000);
    return () => clearInterval(id);
  }, [recall]);

  const pool = recall ? 회상문구 : 일반문구;
  return (
    <div className={'loading' + (recall ? ' recall' : '')} role="status" aria-live="polite">
      <div className="loading-dots">
        <i />
        <i />
        <i />
      </div>
      {/* key로 매 교체 시 페이드 재생 */}
      <span className="loading-text" key={i}>
        {pool[i]}
      </span>
    </div>
  );
}
