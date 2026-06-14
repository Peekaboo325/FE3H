// 일지(日誌) 탭 — 인물의 '사적 연대기'. 서신의 안쪽 짝(밖↔안).
//  읽는 골격은 연대 문헌(Chronicle)을 닮았다 — 한 줄기로 시간순 쌓이는 목록 → 상세 뷰.
//  서신에서 빌림: 술회 FAB·스피너·소각. 덜어냄: 수신함/발신함/보관함·봉인·발신수신·서명(흘림체).
//  날것·수수한 사적 페이지(흘림체·봉인 없음) — 설계 = docs/일지_설계.md.
import { useState } from 'react';
import { Feather, X, ArrowLeft } from 'lucide-react';
import IconButton from './IconButton';
import Spinner from './Spinner';
import { UI } from './strings';
import type { CharReport, JournalEntry } from './useCharacters';

// 미작성/술회 중 화면용 골격 — 흐릿하게 깔리므로 내용은 자리채움.
const 골격일지: JournalEntry[] = [
  { title: '여느 날', body: '새벽 종소리에 눈을 떴다. 멀건 죽 한 그릇으로 속을 데우고, 늘 그렇듯 마당을 한 바퀴 돌았다. 별일 없는 하루였다.' },
  { title: '잠 못 드는 밤', body: '요 며칠 마음이 자꾸 한곳에 머문다. 낮의 소임은 손에 익어 무던히 흘렀는데, 밤이 되니 그 한마디가 다시 떠오른다.' },
];

// 목록 행 — 제목 + 본문 2줄 미리보기(연대 문헌 클래스 재사용).
function JournalRow({ e, onOpen }: { e: JournalEntry; onOpen: () => void }) {
  return (
    <button className="chronicle-row" onClick={onOpen}>
      <div className="chronicle-title">{e.title || '제목 없는 날'}</div>
      <p className="chronicle-summary clamp2">{e.body}</p>
    </button>
  );
}

export default function JournalTab({
  report,
  journaling,
  armedId,
  onWrite,
  onBurn,
}: {
  report?: CharReport | null;
  journaling: boolean;
  armedId: string | null;
  onWrite: () => void;
  onBurn: (e: JournalEntry) => void;
}) {
  const journals = report?.journals;
  const [openId, setOpenId] = useState<string | null>(null);
  const open = journals?.find((j) => j.id === openId) || null;

  // 첫 술회 중(일지 없음) — 골격 흐리고 스피너로 '작동 중'.
  if (journaling && !journals?.length) {
    return (
      <div className="report-locked">
        <div className="journal-list report--ghost" aria-hidden="true">
          {골격일지.map((e, i) => (
            <JournalRow key={i} e={e} onOpen={() => {}} />
          ))}
        </div>
        <div className="report-lock-overlay">
          <Spinner />
        </div>
      </div>
    );
  }

  // 상세 뷰 — 뒤로(←) + 소각(두 번 누르기), 제목, 본문(개행 보존).
  if (open) {
    return (
      <div className="journal-detail">
        <div className="journal-detail-head">
          <IconButton label={UI.close} onClick={() => setOpenId(null)}>
            <ArrowLeft size={18} />
          </IconButton>
          <IconButton
            label={UI.erase}
            className={'journal-burn' + (armedId === open.id ? ' armed' : '')}
            onClick={() => onBurn(open)}
          >
            <X size={16} />
          </IconButton>
        </div>
        {open.title && <h3 className="journal-title">{open.title}</h3>}
        <div className="journal-body">{open.body}</div>
      </div>
    );
  }

  // 목록 — 일지장(최신이 위) + 하단 술회 FAB.
  if (journals?.length) {
    return (
      <div className="journal">
        <div className="journal-list">
          {journals.map((e) => (
            <JournalRow key={e.id} e={e} onOpen={() => setOpenId(e.id!)} />
          ))}
        </div>
        <div className="report-foot">
          <IconButton label={UI.journalize} onClick={onWrite} disabled={journaling}>
            {journaling ? <span className="spinner" /> : <Feather size={17} />}
          </IconButton>
        </div>
      </div>
    );
  }

  // 미작성 — 골격 흐리고 위쪽에 안내·술회 버튼.
  return (
    <div className="report-locked">
      <div className="journal-list report--ghost" aria-hidden="true">
        {골격일지.map((e, i) => (
          <JournalRow key={i} e={e} onOpen={() => {}} />
        ))}
      </div>
      <div className="report-lock-overlay">
        <p className="report-lock-msg">아직 적힌 일지가 없습니다.</p>
        <button className="list-btn" onClick={onWrite}>
          오늘 하루를 적다
        </button>
      </div>
    </div>
  );
}
