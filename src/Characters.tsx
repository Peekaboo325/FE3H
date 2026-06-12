import { useState, useEffect, Fragment, type ReactNode } from 'react';
import { 이미지를_썸네일로 } from './imageUtils';
import { showToast } from './toast';
import { useCharacters, type Character, type Bond, type CharReport, type QuestItem, type BelongingItem } from './useCharacters';
import { UI } from './strings';
import IconButton from './IconButton';
import Button from './Button';
import Spinner from './Spinner';
import ImportDialog from './ImportDialog';
import FaceCrop from './FaceCrop';
import { nameDict } from './nameDict.generated';
import { splitAliases, firstName } from './nameUtils';
import Markdown from './Markdown';
import Dropdown from './Dropdown';
import useEscClose from './useEscClose';
import { ImagePlus, Crop, Eraser, Flame, ArrowLeft, Bookmark, Pencil, X, MapPin, ChevronDown, UserPlus, Download, Trash2, RotateCcw, Plus, Search } from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSortSensors, sortGuardProps } from './useSortSensors';
import LettersTab from './LettersTab';

const 빈인물 = (): Character => ({
  name: '',
  english_name: '',
  aliases: '',
  faction: '',
  appearance: '',
  personality: '',
  combat: '',
  notes: '',
  life_status: 'alive',
  is_active: true,
  thumbnail: '',
  avatar: '',
});

// 이미지가 없을 때 쓰는 기본 그림 (매핑: 히어로=아바타 그림 / 목록 썸네일=포트레이트 그림).
const HERO_PLACEHOLDER = '/assets/illust/avatar-placeholder.webp'; // 히어로(인물 카드)용
const LIST_PLACEHOLDER = '/assets/illust/portrait-placeholder.webp'; // 명부 목록 둥근 썸네일용

// 생사 상태 → 표시 라벨
const 상태label: Record<string, string> = { alive: '생존', deceased: '사망', unknown: '불명' };

// 생사 상태 → 초상/썸네일 효과 클래스 (사망=흑백, 불명=흑백+어둡게)
const statusFx = (s?: string) =>
  s === 'deceased' ? 'fx-dead' : s === 'unknown' ? 'fx-unknown' : '';

// 뷰 모드의 한 섹션(내용 있을 때만 호출).
function ViewSection({ label, text }: { label: string; text: string }) {
  return (
    <div className="view-section">
      <div className="view-label">{label}</div>
      <div className="view-text">
        <Markdown text={text} />
      </div>
    </div>
  );
}

// 인물 뷰 탭 — 5종 전부 가동(서신이 마지막으로 채워졌다).
const 인물탭 = ['약력', '보고서', '임무', '소지품', '서신'] as const;

// 보고서 능력치 8종 (키→라벨). 서버 lib/report.mjs STAT_KEYS와 일치해야 한다.
const 능력치목록: [string, string][] = [
  ['prowess', '무력'],
  ['magic', '마력'],
  ['faith', '신앙'],
  ['intellect', '지성'],
  ['standing', '입지'],
  ['wealth', '재력'],
  ['charm', '매력'],
  ['resilience', '정신'],
];

// 능력치 한 줄(라벨·점수·막대·한 줄 평).
function StatBar({ label, value, comment }: { label: string; value: number; comment?: string }) {
  return (
    <div className="stat-row">
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        {comment && <span className="stat-cmt">{comment}</span>}
        <span className="stat-num">{value}</span>
      </div>
      <span className="stat-track">
        <span className="stat-fill" style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

// 능력치 8종을 한눈에 — 팔각형 레이더 그래프(SVG, 의존성 없음).
function StatRadar({ stats }: { stats: Record<string, number> }) {
  const size = 240;
  const c = size / 2;
  const R = c - 30; // 라벨 자리 여백
  const n = 능력치목록.length; // 8
  const pt = (i: number, radius: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; // 12시 방향부터 시계방향
    return [c + radius * Math.cos(a), c + radius * Math.sin(a)];
  };
  const poly = (radius: number | ((i: number) => number)) =>
    능력치목록
      .map((_, i) => pt(i, typeof radius === 'function' ? radius(i) : radius).join(','))
      .join(' ');
  const val = (i: number) => {
    const v = stats?.[능력치목록[i][0]] ?? 0;
    return (R * Math.max(0, Math.min(100, v))) / 100;
  };
  return (
    <svg className="stat-radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="능력치 그래프">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} className="radar-ring" points={poly(R * f)} />
      ))}
      {능력치목록.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} className="radar-axis" x1={c} y1={c} x2={x} y2={y} />;
      })}
      <polygon className="radar-area" points={poly(val)} />
      {능력치목록.map(([, ko], i) => {
        const [x, y] = pt(i, R + 16);
        return (
          <text key={i} className="radar-label" x={x} y={y} textAnchor="middle" dominantBaseline="central">
            {ko}
          </text>
        );
      })}
    </svg>
  );
}

// 보고서 본문 렌더(발급본·골격 공용) — 2단: 왼쪽 능력치(인용구·해시태그·레이더·막대) / 오른쪽 분석.
function ReportBody({ report }: { report: CharReport }) {
  return (
    <div className="report-body">
      {report.quote && <p className="report-quote">{report.quote}</p>}
      {!!report.hashtags?.length && (
        <div className="report-tags">
          {report.hashtags.map((t, i) => (
            <span key={i} className="report-tag">
              #{t}
            </span>
          ))}
        </div>
      )}
      {/* 능력 — 레이더 + 막대 그래프 (한 줄) */}
      <div className="report-stats-row">
        <div className="view-label report-stats-head">능력</div>
        <StatRadar stats={report.stats ?? {}} />
        <div className="report-stats">
          {능력치목록.map(([k, ko]) => (
            <StatBar
              key={k}
              label={ko}
              value={report.stats?.[k] ?? 0}
              comment={report.stat_comments?.[k]}
            />
          ))}
        </div>
      </div>
      {/* 성격 분석 + 무의식 분석 (한 줄) */}
      <div className="report-analysis-row">
        {report.personality && <ViewSection label="행동 양상" text={report.personality} />}
        {report.unconscious && <ViewSection label="잠재 심리" text={report.unconscious} />}
      </div>
      {!!report.reputation?.length && (
        <div className="view-section">
          <div className="view-label">평판</div>
          <ul className="rep-list">
            {report.reputation.map((r, i) => (
              <li key={i} className="rep-item">
                <div className="rep-src">{r.source}</div>
                <div className="rep-cmt">{r.comment}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// 미발급/발급중 화면용 골격 — 흐릿하게 깔리므로 내용은 그저 그럴듯한 자리채움.
const 골격보고서: CharReport = {
  quote: '아직 거두지 못한 한마디',
  hashtags: ['미상', '미상', '미상', '미상', '미상'],
  stats: {
    prowess: 62,
    magic: 38,
    faith: 74,
    intellect: 56,
    standing: 80,
    wealth: 47,
    charm: 64,
    resilience: 33,
  },
  stat_comments: {
    prowess: '아직 가늠하지 못함',
    magic: '아직 가늠하지 못함',
    faith: '아직 가늠하지 못함',
    intellect: '아직 가늠하지 못함',
    standing: '아직 가늠하지 못함',
    wealth: '아직 가늠하지 못함',
    charm: '아직 가늠하지 못함',
    resilience: '아직 가늠하지 못함',
  },
  personality:
    '겉으로 드러나는 면모와 행동의 결이 이 자리에 적힌다. 분석관이 인물을 들여다보면 그 윤곽이 또렷이 떠오를 것이다.',
  unconscious:
    '본인도 미처 헤아리지 못한 내면의 동기와 오래된 상처가 이 자리에 새겨진다. 아직은 안개 너머에 잠들어 있다.',
  reputation: [
    { source: '아직 이름 없는 목소리', comment: '그분에 대해선 아직 할 말을 고르는 중이라네.' },
    { source: '아직 이름 없는 목소리', comment: '소문이 닿기엔 너무 먼 분이지.' },
    { source: '아직 이름 없는 목소리', comment: '글쎄, 무어라 말해야 할지.' },
    { source: '아직 이름 없는 목소리', comment: '곧 누군가 입을 열 테지.' },
    { source: '아직 이름 없는 목소리', comment: '판단은 잠시 미뤄두겠네.' },
    { source: '아직 이름 없는 사물', comment: '…….' },
  ],
};

// 보고서 탭 — 발급본이 있으면 그대로, 없으면(또는 발급 중) 골격을 흐리고 위에 안내·버튼.
function ReportView({
  report,
  reporting,
  onIssue,
}: {
  report?: CharReport | null;
  reporting: boolean;
  onIssue: () => void;
}) {
  // 첫 발급 중(보고서 없음) — 골격 흐리고 스피너로 '작동 중'.
  if (reporting && !report) {
    return (
      <div className="report-locked">
        <div className="report report--ghost" aria-hidden="true">
          <ReportBody report={골격보고서} />
        </div>
        <div className="report-lock-overlay">
          <Spinner />
        </div>
      </div>
    );
  }
  if (report) {
    return (
      <div className="report">
        <ReportBody report={report} />
        <div className="report-foot">
          <IconButton
            label={UI.regen}
            onClick={onIssue}
            disabled={reporting}
            className={reporting ? 'spinning' : ''}
          >
            <RotateCcw size={17} />
          </IconButton>
        </div>
      </div>
    );
  }
  // 미발급 — 골격 흐리고 위쪽에 안내·발급 버튼.
  return (
    <div className="report-locked">
      <div className="report report--ghost" aria-hidden="true">
        <ReportBody report={골격보고서} />
      </div>
      <div className="report-lock-overlay">
        <p className="report-lock-msg">아직 발급되지 않은 보고서입니다.</p>
        <button className="list-btn" onClick={onIssue}>
          분석 보고서 발급
        </button>
      </div>
    </div>
  );
}

// 미발급/발급중 화면용 임무 골격 — 흐릿하게 깔리므로 내용은 자리채움.
const 골격임무: QuestItem[] = [
  { type: '의무', name: '국경의 동태 확인', description: '소문이 사실인지 이 눈으로 확인해보자.', reward: '갓 들어온 전갈 한 통' },
  { type: '교류', name: '오랜 벗과의 대국', description: '요즘 통 보이지 않던데, 차나 한잔 청해야겠어.', reward: '식어버린 홍차의 향' },
  { type: '돌발', name: '새벽 단련', description: '잠이 오지 않는 밤엔 검이라도 휘두르는 게 좋겠군.', reward: '손바닥의 물집' },
];

// 임무 카드 한 장 — 유형 칩 + 제목 / 1인칭 독백 / 보상 줄.
function QuestCard({ q }: { q: QuestItem }) {
  return (
    <li className="quest-card">
      <div className="quest-head">
        <span className="quest-type">{q.type}</span>
        <span className="quest-name">{q.name}</span>
      </div>
      <p className="quest-desc">“{q.description}”</p>
      <div className="quest-reward">
        <span className="quest-reward-label dim">보상</span>
        <span className="quest-reward-value">{q.reward}</span>
      </div>
    </li>
  );
}

// 임무 탭 — 발급본이 있으면 그대로, 없으면(또는 발급 중) 골격을 흐리고 위에 안내·버튼.
//  보고서 탭(ReportView)과 같은 문법: 인물이 '스스로 꾸미는 계획'의 장부라 구경거리다.
function QuestsView({
  report,
  questing,
  onIssue,
}: {
  report?: CharReport | null;
  questing: boolean;
  onIssue: () => void;
}) {
  const quests = report?.quests;
  // 첫 발급 중(장부 없음) — 골격 흐리고 스피너로 '작동 중'.
  if (questing && !quests?.length) {
    return (
      <div className="report-locked">
        <ul className="quest-list report--ghost" aria-hidden="true">
          {골격임무.map((q, i) => (
            <QuestCard key={i} q={q} />
          ))}
        </ul>
        <div className="report-lock-overlay">
          <Spinner />
        </div>
      </div>
    );
  }
  if (quests?.length) {
    return (
      <div className="report report--quests">
        <ul className="quest-list">
          {quests.map((q, i) => (
            <QuestCard key={i} q={q} />
          ))}
        </ul>
        <div className="report-foot">
          <IconButton label={UI.regen} onClick={onIssue} disabled={questing}>
            {questing ? <span className="spinner" /> : <Search size={17} />}
          </IconButton>
        </div>
      </div>
    );
  }
  // 미발급 — 골격 흐리고 위쪽에 안내·발급 버튼.
  return (
    <div className="report-locked">
      <ul className="quest-list report--ghost" aria-hidden="true">
        {골격임무.map((q, i) => (
          <QuestCard key={i} q={q} />
        ))}
      </ul>
      <div className="report-lock-overlay">
        <p className="report-lock-msg">아직 발급되지 않은 임무 장부입니다.</p>
        <button className="list-btn" onClick={onIssue}>
          임무 장부 발급
        </button>
      </div>
    </div>
  );
}

// 미발급/탐색중 화면용 소지품 골격 — 흐릿하게 깔리므로 내용은 자리채움.
const 골격소지품: BelongingItem[] = [
  { name: '낡은 가죽 장갑', comment: '오래 길든 듯 손 모양이 남아 있다.' },
  { name: '반쯤 탄 양초', comment: '밤늦게까지 켜둔 듯하다.' },
  { name: '작은 휴대용 숫돌', comment: '희미한 쇳내가 난다.' },
];

// 물건 그림 — icon key로 /assets/illust/items/<key>.webp. 그림이 없거나 못 읽으면 공용 문양(fallback.webp).
//  ⚠️ 그림은 오직 icon prop의 함수 — 어떤 내부 상태도 '그 아이콘'에만 묶는다.
//   · 실패는 '실패한 icon 이름'으로 기억 → 다른 물건(다른 icon)으로 바뀌면 자동 무효(이웃 칸으로 누수 차단).
//   · <img>에 key={해석된 파일명} → 파일이 바뀌면 DOM을 새로 그린다(재사용 노드의 잔상 차단).
//   · 명령형 DOM 조작(style 직접 수정) 금지 — React가 못 따라가 잔상이 남는다.
function ItemIcon({ icon }: { icon?: string }) {
  const [brokenIcon, setBrokenIcon] = useState<string | null>(null);
  const resolved = icon && brokenIcon !== icon ? icon : 'fallback';
  return (
    <div className="item-icon">
      <img
        key={resolved}
        src={`/assets/illust/items/${resolved}.webp`}
        alt=""
        draggable={false}
        onError={() => {
          if (resolved !== 'fallback') setBrokenIcon(icon ?? null);
        }}
      />
    </div>
  );
}

// 소지품 카드 한 장 — 그림 + 이름 + 단정하지 않는 한 줄 (골격용·정렬 없음).
function ItemCard({ b }: { b: BelongingItem }) {
  return (
    <li className="item-card">
      <ItemIcon icon={b.icon} />
      <div className="item-name">{b.name}</div>
      <div className="item-divider" />
      <p className="item-comment">{b.comment}</p>
    </li>
  );
}

// 드래그로 정렬 가능한 소지품 카드 + 두 번 누르기 소각(첫 클릭=활성·붉게, 둘째=실행).
function SortableItemCard({
  b,
  armed,
  onBurn,
}: {
  b: BelongingItem;
  armed: boolean;
  onBurn: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: b.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : undefined,
    zIndex: isDragging ? 5 : undefined,
  };
  return (
    <li ref={setNodeRef} style={style} className="item-card" {...sortGuardProps} {...attributes} {...listeners}>
      <IconButton
        label={UI.erase}
        className={'item-burn' + (armed ? ' armed' : '')}
        onClick={(e) => {
          e.stopPropagation(); // 바깥 클릭=해제 리스너가 이 클릭을 '바깥'으로 오인하지 않게
          onBurn();
        }}
      >
        <X size={13} />
      </IconButton>
      <ItemIcon icon={b.icon} />
      <div className="item-name">{b.name}</div>
      <div className="item-divider" />
      <p className="item-comment">{b.comment}</p>
    </li>
  );
}

// 소지품 탭 — 탐색할 때마다 물건이 '누적'되는 주머니. 드래그 정렬 + 개별 소각(두 번 누르기).
function ItemsView({
  report,
  exploring,
  armedId,
  onExplore,
  onBurn,
  onReorder,
}: {
  report?: CharReport | null;
  exploring: boolean;
  armedId: string | null;
  onExplore: () => void;
  onBurn: (b: BelongingItem) => void;
  onReorder: (activeId: string, overId: string) => void;
}) {
  const items = report?.belongings;
  const sensors = useSortSensors();
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };
  // 첫 탐색 중(주머니 비어 있음) — 골격 흐리고 스피너로 '작동 중'.
  if (exploring && !items?.length) {
    return (
      <div className="report-locked">
        <ul className="item-grid report--ghost" aria-hidden="true">
          {골격소지품.map((b, i) => (
            <ItemCard key={i} b={b} />
          ))}
        </ul>
        <div className="report-lock-overlay">
          <Spinner />
        </div>
      </div>
    );
  }
  if (items?.length) {
    return (
      <div className="report report--quests">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((b) => b.id!)} strategy={rectSortingStrategy}>
            <ul className="item-grid">
              {items.map((b, i) => (
                <SortableItemCard
                  key={b.id ?? i}
                  b={b}
                  armed={armedId != null && armedId === b.id}
                  onBurn={() => onBurn(b)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="report-foot">
          <IconButton label={UI.explore} onClick={onExplore} disabled={exploring}>
            {exploring ? <span className="spinner" /> : <Search size={17} />}
          </IconButton>
        </div>
      </div>
    );
  }
  // 빈 주머니 — 골격 흐리고 위쪽에 안내·탐색 버튼.
  return (
    <div className="report-locked">
      <ul className="item-grid report--ghost" aria-hidden="true">
        {골격소지품.map((b, i) => (
          <ItemCard key={i} b={b} />
        ))}
      </ul>
      <div className="report-lock-overlay">
        <p className="report-lock-msg">아직 확인하지 않은 소지품입니다.</p>
        <button className="list-btn" onClick={onExplore}>
          소지품 {UI.explore}
        </button>
      </div>
    </div>
  );
}

// (괄호) 안 텍스트를 작고 연하게 — 약력 값의 부연 설명 톤. (Markdown 경량 렌더러와 동일 규칙)
function dimParens(text: string): ReactNode[] {
  return (text ?? '').split(/(\([^)]*\))/g).map((p, i) =>
    p.startsWith('(') && p.endsWith(')') ? (
      <span key={i} className="paren-dim">
        {p}
      </span>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

// 신원 카드의 한 줄(라벨 + 값).
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row-label">{label}</span>
      <span className="info-row-value">{dimParens(value)}</span>
    </div>
  );
}

// 드래그로 정렬 가능한 목록 행.
// 드래그로 정렬 가능한 초상 카드(갤러리 한 칸).
function SortableCharCard({
  c,
  onOpen,
  onToggle,
}: {
  c: Character;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id!,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  const active = c.is_active !== false;
  const alias = splitAliases(c.aliases)[0] || '';
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={'char-card' + (active ? '' : ' inactive')}
      onClick={onOpen}
      {...sortGuardProps}
      {...attributes}
      {...listeners}
    >
      <div className="char-card-img">
        <img
          className={statusFx(c.life_status)}
          src={c.thumbnail || c.avatar || HERO_PLACEHOLDER}
          alt=""
          draggable={false}
        />
        {c.life_status === 'unknown' && <span className="card-q">?</span>}
        <button
          className={'card-bm' + (active ? ' on' : '')}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={active ? '등장 끄기' : '등장 켜기'}
        >
          <Bookmark size={15} fill={active ? 'currentColor' : 'none'} />
        </button>
        <div className="char-card-grad" />
        <div className="char-card-meta">
          <div className="char-card-name">{firstName(c.name)}</div>
          {alias && <div className="char-card-sub">{alias}</div>}
        </div>
      </div>
    </li>
  );
}

// 드래그로 정렬 가능한 인연(뷰) 행.
function SortableBond({
  id,
  avatar,
  fname,
  category,
  description,
}: {
  id: string;
  avatar: string;
  fname: string;
  category?: string;
  description?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };
  return (
    <li ref={setNodeRef} style={style} className="bond-row" {...sortGuardProps} {...attributes} {...listeners}>
      <div className="bond-left">
        <img className="bond-av" src={avatar} alt="" />
        <div className="bond-id">
          <div className="bond-fname">{fname}</div>
          {category && <div className="bond-rel">{category}</div>}
        </div>
      </div>
      {description && <div className="bond-desc">{description}</div>}
    </li>
  );
}

export default function Characters({
  storyId,
  onClose,
}: {
  storyId: number | null;
  onClose: () => void;
}) {
  // 현재 이야기의 인물만 본다(이야기별 분리).
  const { chars, loading, dbReady, err, refresh } = useCharacters(storyId);
  const [viewing, setViewing] = useState<Character | null>(null); // 읽기 모드
  const [editing, setEditing] = useState<Character | null>(null); // 편집 모드
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [cropping, setCropping] = useState(false); // 초상에서 얼굴 따기
  const [tab, setTab] = useState<string>('약력'); // 인물 뷰 탭
  const [bondsOpen, setBondsOpen] = useState(false); // 인연 카드 펼침/접힘(기본 접힘)
  const [editBondsOpen, setEditBondsOpen] = useState(false); // 편집 모드 인연도 기본 접힘
  const [reporting, setReporting] = useState(false); // 보고서 발급 중
  const [questing, setQuesting] = useState(false); // 임무 장부 발급 중
  const [exploring, setExploring] = useState(false); // 소지품 탐색 중
  const [armedItemId, setArmedItemId] = useState<string | null>(null); // 소지품 소각 두 번 누르기 대상
  useEffect(() => setArmedItemId(null), [tab]); // 탭을 옮기면 활성 해제
  // ESC = 그 화면의 뒤로/취소(없으면 닫기) — 편집 중 실수로 패널 전체가 닫히지 않게 한 겹씩.
  //  (크롭·반입·다이얼로그가 떠 있을 땐 그쪽이 스택 맨 위라 여긴 안 불린다.)
  useEscClose(() => {
    if (editing) setEditing(null);
    else if (viewing) setViewing(null);
    else onClose();
  });
  // 바깥을 누르면 활성 해제 — 여는 클릭이 바로 해제하지 않게 다음 틱부터 듣는다(천각의 박동 메뉴와 동일 패턴).
  useEffect(() => {
    if (armedItemId == null) return;
    const close = () => setArmedItemId(null);
    const id = window.setTimeout(() => document.addEventListener('click', close), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('click', close);
    };
  }, [armedItemId]);
  const [armed, setArmed] = useState(false); // 삭제 두 번 누르기: 첫 클릭=활성, 둘째=실행
  useEffect(() => setArmed(false), [editing]); // 다른 인물로 옮기거나 닫으면 해제
  useEffect(() => {
    setTab('약력');
    setBondsOpen(false);
    setEditBondsOpen(false);
    setArmedItemId(null);
  }, [viewing?.id]); // 다른 인물(id 변경) 열 때만 약력·인연 접힘 초기화

  // 분석 보고서 발급(또는 새로고침/재작성) — Gemini Flash가 약력·맥락을 읽고 짓는다.
  async function 발급() {
    if (!viewing?.id || reporting) return;
    const 이전 = viewing.analysis ?? null; // 갱신 여부 판단용(이전 보고서)
    setReporting(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character_id: viewing.id, story_id: storyId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(이전 ? '보고서를 갱신하지 못했습니다.' : '보고서를 발급하지 못했습니다.');
        return;
      }
      setViewing((v) => (v ? { ...v, analysis: data.report } : v));
      await refresh();
      // 발급/갱신 알림 — 내용이 실제로 바뀐 경우만(generated_at 제외 비교).
      const 알맹이 = (r: CharReport | null) => (r ? JSON.stringify({ ...r, generated_at: '' }) : '');
      if (!이전) showToast('보고서가 발급되었습니다.');
      else if (알맹이(이전) !== 알맹이(data.report)) showToast('보고서가 갱신되었습니다.');
    } catch {
      showToast(이전 ? '보고서를 갱신하지 못했습니다.' : '보고서를 발급하지 못했습니다.');
    } finally {
      setReporting(false);
    }
  }

  // 임무 장부 발급(또는 재작성) — Gemini Flash가 약력·맥락을 읽고 '인물이 스스로 꾸미는 계획'을 짓는다.
  async function 임무발급() {
    if (!viewing?.id || questing) return;
    const 이전 = viewing.analysis?.quests?.length ? viewing.analysis.quests : null;
    const 이름 = firstName(viewing.name);
    setQuesting(true);
    try {
      const res = await fetch('/api/quests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character_id: viewing.id, story_id: storyId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(이전 ? '임무를 갱신하지 못했습니다.' : '임무를 전달하지 못했습니다.');
        return;
      }
      setViewing((v) => (v ? { ...v, analysis: data.report } : v));
      await refresh();
      showToast(`${이름}의 임무가 ${이전 ? '갱신' : '전달'}되었습니다.`);
    } catch {
      showToast(이전 ? '임무를 갱신하지 못했습니다.' : '임무를 전달하지 못했습니다.');
    } finally {
      setQuesting(false);
    }
  }

  // 소지품 탐색 — Gemini Flash가 물건 3점을 새로 찾아 주머니에 누적한다.
  async function 탐색() {
    if (!viewing?.id || exploring) return;
    const 이름 = firstName(viewing.name);
    setExploring(true);
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character_id: viewing.id, story_id: storyId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast('소지품을 확인하지 못했습니다.');
        return;
      }
      setViewing((v) => (v ? { ...v, analysis: data.report } : v));
      await refresh();
      showToast(`${이름}의 소지품이 새로 확인되었습니다.`);
    } catch {
      showToast('소지품을 확인하지 못했습니다.');
    } finally {
      setExploring(false);
    }
  }

  // 소지품 소각 — 두 번 누르기(앱 공통 메커니즘): 첫 클릭=활성(붉게), 둘째 클릭=실행.
  async function 물건소각(b: BelongingItem) {
    if (!viewing?.id || !b.id) return;
    if (armedItemId !== b.id) {
      setArmedItemId(b.id);
      return;
    }
    setArmedItemId(null);
    try {
      const res = await fetch(`/api/items?character_id=${viewing.id}&id=${encodeURIComponent(b.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(`소지품을 ${UI.erase}하지 못했습니다.`);
        return;
      }
      setViewing((v) => (v ? { ...v, analysis: data.report } : v));
      await refresh();
    } catch {
      showToast(`소지품을 ${UI.erase}하지 못했습니다.`);
    }
  }

  // 소지품 드래그 정렬 — 화면 먼저 바꾸고(낙관적), 순서를 서버에 새긴다.
  async function 물건정렬(activeId: string, overId: string) {
    if (!viewing?.id) return;
    const list = viewing.analysis?.belongings;
    if (!list?.length) return;
    const from = list.findIndex((b) => b.id === activeId);
    const to = list.findIndex((b) => b.id === overId);
    if (from < 0 || to < 0) return;
    const next = arrayMove(list, from, to);
    setViewing((v) =>
      v ? { ...v, analysis: { ...(v.analysis || {}), belongings: next } } : v,
    );
    setArmedItemId(null);
    try {
      const res = await fetch('/api/items', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character_id: viewing.id, order: next.map((b) => b.id) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast('정렬을 완료하지 못했습니다.');
        return;
      }
      await refresh();
    } catch {
      showToast('정렬을 완료하지 못했습니다.');
    }
  }

  function set<K extends keyof Character>(k: K, v: Character[K]) {
    setEditing((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f || !editing) return;
    try {
      const thumb = await 이미지를_썸네일로(f); // 초상: 큰 히어로용(1400px)
      set('thumbnail', thumb);
    } catch {
      showToast('초상을 등록하지 못했습니다.');
    }
  }

  async function save() {
    if (!editing) return;
    if (!editing.name.trim()) {
      showToast('인물의 성명을 입력하십시오.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...editing, story_id: storyId };
      if (payload.bonds) payload.bonds = payload.bonds.filter((b) => b.name?.trim());
      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character: payload }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(`인물을 ${UI.save}하지 못했습니다.`);
        return;
      }
      await refresh();
      setEditing(null);
      if (data.character) setViewing(data.character); // 저장 후 뷰로
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!editing.id) {
      setEditing(null);
      return;
    }
    const res = await fetch(`/api/characters?id=${editing.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || data.error) {
      showToast(`인물을 ${UI.erase}하지 못했습니다.`);
      return;
    }
    await refresh();
    setEditing(null);
    setViewing(null); // 소각 후 목록으로
  }

  // 뷰모드에서 활성(등장) 토글 — 즉시 저장(낙관적 갱신)
  async function toggleActive() {
    if (!viewing) return;
    const prev = viewing;
    const updated = { ...viewing, is_active: viewing.is_active === false };
    setViewing(updated);
    try {
      await fetch('/api/characters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ character: { ...updated, story_id: storyId } }),
      });
      await refresh();
    } catch {
      setViewing(prev); // 실패 시 되돌림
    }
  }

  // 목록에서 활성(등장) 토글 — 즉시 저장 후 새로고침
  async function toggleActiveOf(c: Character) {
    await fetch('/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ character: { ...c, is_active: c.is_active === false, story_id: storyId } }),
    });
    await refresh();
  }

  // 드래그 정렬용 로컬 순서(서버 목록과 동기화) + 마우스·터치 센서
  const [items, setItems] = useState<Character[]>([]);
  useEffect(() => setItems(chars), [chars]);
  const sensors = useSortSensors();

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((c) => c.id === active.id);
    const newIndex = items.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next); // 낙관적 즉시 반영
    // 순서(sort_order)가 바뀐 항목만 저장
    const changed = next
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => c.sort_order !== i);
    await Promise.all(
      changed.map(({ c, i }) =>
        fetch('/api/characters', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ character: { ...c, sort_order: i, story_id: storyId } }),
        }),
      ),
    );
    await refresh();
  }

  // 뷰에서 인연 순서 드래그 변경 — 즉시 저장
  async function onBondDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id || !viewing) return;
    const list = (viewing.bonds || []).filter((b) => b.name?.trim());
    const oldIndex = list.findIndex((b) => b.name === active.id);
    const newIndex = list.findIndex((b) => b.name === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(list, oldIndex, newIndex);
    const updated = { ...viewing, bonds: next };
    setViewing(updated);
    await fetch('/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ character: { ...updated, story_id: storyId } }),
    });
    await refresh();
  }

  // 인연 편집: 추가/수정/삭제
  function addBond() {
    set('bonds', [...(editing?.bonds || []), { name: '', category: '', description: '' }]);
  }
  function updateBond(i: number, patch: Partial<Bond>) {
    set(
      'bonds',
      (editing?.bonds || []).map((b, j) => (j === i ? { ...b, ...patch } : b)),
    );
  }
  function removeBond(i: number) {
    set(
      'bonds',
      (editing?.bonds || []).filter((_, j) => j !== i),
    );
  }

  // 인연 대상 이름 → 명부 인물(아바타 자동 연동용)
  const charByName = new Map(chars.map((c) => [c.name, c]));

  const viewMode = viewing && !editing; // 순수 읽기 모드

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className={'modal has-hero' + (!editing && !viewing ? ' modal--list' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 풀스크린: 노치/상태바 아래(안전영역) 차폐 — 스티키 탭 위로 콘텐츠 새는 것 방지 */}
        <div className="top-shield" />
        {/* 헤더·안내 — 뷰/편집 모드에선 히어로가 대신하므로 숨김(목록 모드 전용) */}
        {!viewMode && !editing && (
          <>
            <div className="modal-head">
              {/* 헤더 문법: 왼쪽 = 동작(또는 뒤로), 가운데 = 제목, 오른쪽 = 닫기뿐 */}
              <div className="head-side">
                {chars.length > 0 && (
                  <>
                    <IconButton label="작성" onClick={() => setEditing(빈인물())}>
                      <UserPlus size={17} />
                    </IconButton>
                    {storyId != null && (
                      <IconButton label={UI.import} onClick={() => setImporting(true)}>
                        <Download size={17} />
                      </IconButton>
                    )}
                  </>
                )}
              </div>
              <h2>인물 명부</h2>
              <div className="head-actions">
                <IconButton label={UI.close} onClick={onClose}>
                  <X size={17} />
                </IconButton>
              </div>
            </div>

            {!dbReady && <p className="warn">아직 기록의 샘이 닿지 않아 인물을 기록할 수 없습니다.</p>}
            {dbReady && err && (
              <p className="warn">
                인물 표가 아직 없는 듯합니다. 안내된 SQL을 Supabase에서 한 번 실행하십시오.
                <br />
                <span className="dim">({err})</span>
              </p>
            )}
            {storyId == null && <p className="warn">먼저 운명의 장을 펼치십시오.</p>}
          </>
        )}

        {/* 뷰(읽기) 화면 */}
        {viewMode && viewing && (
          <div className="char-view">
            <div className="char-hero">
              <div className="char-hero-top">
                <IconButton label="목록으로" onClick={() => setViewing(null)}>
                  <ArrowLeft size={18} />
                </IconButton>
                <div className="hero-top-right">
                  <IconButton
                    label={viewing.is_active !== false ? '등장 끄기' : '등장 켜기'}
                    active={viewing.is_active !== false}
                    onClick={toggleActive}
                  >
                    <Bookmark size={18} fill={viewing.is_active !== false ? 'currentColor' : 'none'} />
                  </IconButton>
                  <IconButton label={UI.edit} onClick={() => setEditing(viewing)}>
                    <Pencil size={17} />
                  </IconButton>
                  <IconButton label={UI.close} onClick={onClose}>
                    <X size={18} />
                  </IconButton>
                </div>
              </div>
              <div className="char-hero-portrait">
                <img
                  className={statusFx(viewing.life_status)}
                  src={viewing.thumbnail || viewing.avatar || HERO_PLACEHOLDER}
                  alt=""
                />
                {viewing.life_status === 'unknown' && <span className="hero-q">?</span>}
              </div>
              <div className="char-hero-info">
                <div className="char-hero-name">
                  {viewing.name}
                </div>
                {viewing.english_name && <div className="char-hero-en">{viewing.english_name}</div>}
                {splitAliases(viewing.aliases).length > 0 && (
                  <div className="char-hero-chips">
                    {splitAliases(viewing.aliases).map((a, i) => (
                      <span key={i} className="vchip">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {viewing.base && (
                  <div className="hero-base">
                    <MapPin className="hero-pin" size={13} />
                    {viewing.base}
                  </div>
                )}
              </div>
            </div>

            <div className="char-tabs">
              {인물탭.map((t) => (
                <button
                  key={t}
                  className={'char-tab' + (tab === t ? ' active' : '')}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="char-view-body">
              {tab === '약력' ? (
                <>
                  <div className="info-grid">
                    <div className="info-card">
                      <div className="info-card-title">신원</div>
                      {viewing.gender && <InfoRow label="성별" value={viewing.gender} />}
                      {viewing.faction && <InfoRow label="소속" value={viewing.faction} />}
                      {viewing.rank && <InfoRow label="신분" value={viewing.rank} />}
                      {viewing.crest && <InfoRow label="문장" value={viewing.crest} />}
                      <InfoRow label="상태" value={상태label[viewing.life_status || 'alive']} />
                    </div>
                    {(viewing.height ||
                      viewing.build ||
                      viewing.hair ||
                      viewing.iris ||
                      viewing.impression) && (
                      <div className="info-card">
                        <div className="info-card-title">용모</div>
                        {viewing.height && <InfoRow label="신장" value={viewing.height} />}
                        {viewing.build && <InfoRow label="체격" value={viewing.build} />}
                        {viewing.hair && <InfoRow label="모발" value={viewing.hair} />}
                        {viewing.iris && <InfoRow label="홍채" value={viewing.iris} />}
                        {viewing.impression && <InfoRow label="인상" value={viewing.impression} />}
                      </div>
                    )}
                  </div>
                  {viewing.personality && <ViewSection label="성향" text={viewing.personality} />}
                  {viewing.combat && <ViewSection label="전법" text={viewing.combat} />}
                  {viewing.notes && <ViewSection label="비고" text={viewing.notes} />}
                  {(viewing.bonds || []).some((b) => b.name?.trim()) && (
                    <div className="view-section">
                      <button
                        className={'bonds-head' + (bondsOpen ? ' open' : '')}
                        onClick={() => setBondsOpen((o) => !o)}
                      >
                        <span className="view-label">인연</span>
                        <ChevronDown size={18} className={'bonds-chev' + (bondsOpen ? ' open' : '')} />
                      </button>
                      <div className={'bonds-wrap' + (bondsOpen ? ' open' : '')}>
                        <div className="bonds-inner">
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={onBondDragEnd}
                        >
                        <SortableContext
                          items={(viewing.bonds || [])
                            .filter((b) => b.name?.trim())
                            .map((b) => b.name)}
                          strategy={verticalListSortingStrategy}
                        >
                          <ul className="bond-list">
                            {(viewing.bonds || [])
                              .filter((b) => b.name?.trim())
                              .map((b) => {
                                const t = charByName.get(b.name);
                                return (
                                  <SortableBond
                                    key={b.name}
                                    id={b.name}
                                    avatar={t?.avatar || t?.thumbnail || LIST_PLACEHOLDER}
                                    fname={firstName(b.name)}
                                    category={b.category}
                                    description={b.description}
                                  />
                                );
                              })}
                          </ul>
                        </SortableContext>
                      </DndContext>
                        </div>
                        </div>
                    </div>
                  )}
                </>
              ) : tab === '보고서' ? (
                <ReportView
                  report={viewing.analysis}
                  reporting={reporting}
                  onIssue={발급}
                />
              ) : tab === '임무' ? (
                <QuestsView
                  report={viewing.analysis}
                  questing={questing}
                  onIssue={임무발급}
                />
              ) : tab === '소지품' ? (
                <ItemsView
                  report={viewing.analysis}
                  exploring={exploring}
                  armedId={armedItemId}
                  onExplore={탐색}
                  onBurn={물건소각}
                  onReorder={물건정렬}
                />
              ) : (
                <LettersTab
                  ownerId={viewing.id!}
                  storyId={storyId}
                  bondNames={(viewing.bonds ?? []).map((b) => b.name).filter(Boolean)}
                />
              )}
            </div>
          </div>
        )}

        {/* 목록 화면 */}
        {!editing && !viewing && (
          <div className="modal-body">
            {loading ? (
              <Spinner />
            ) : chars.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state-msg">아직 명부에 오른 이가 없습니다.</p>
                <Button variant="primary" onClick={() => setEditing(빈인물())}>
                  첫 인물 등록
                </Button>
                {storyId != null && (
                  <Button variant="secondary" onClick={() => setImporting(true)}>
                    다른 장에서 {UI.import}
                  </Button>
                )}
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={items.map((c) => c.id!)} strategy={rectSortingStrategy}>
                  <ul className="char-grid">
                    {items.map((c) => (
                      <SortableCharCard
                        key={c.id}
                        c={c}
                        onOpen={() => setViewing(c)}
                        onToggle={() => toggleActiveOf(c)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {/* 편집 화면 — 뷰모드와 동일한 히어로+카드 레이아웃(입력형) */}
        {editing && (
          <div className="char-view char-edit">
            <div className="char-hero">
              <div className="char-hero-top">
                <IconButton label={UI.cancel} onClick={() => setEditing(null)}>
                  <ArrowLeft size={18} />
                </IconButton>
                <div className="hero-top-right">
                  <IconButton label={UI.close} onClick={onClose}>
                    <X size={18} />
                  </IconButton>
                </div>
              </div>
              <div className="char-hero-portrait">
                <img
                  className={statusFx(editing.life_status)}
                  src={editing.thumbnail || HERO_PLACEHOLDER}
                  alt=""
                />
                {editing.life_status === 'unknown' && <span className="hero-q">?</span>}
                <div className="portrait-tools">
                  <label className="ptool" data-tip="초상 등록">
                    <ImagePlus size={18} />
                    <input type="file" accept="image/*" onChange={onPickImage} hidden />
                  </label>
                  {editing.thumbnail && (
                    <button className="ptool" data-tip="초점 지정" onClick={() => setCropping(true)}>
                      <Crop size={18} />
                    </button>
                  )}
                  {editing.avatar && (
                    <button className="ptool" data-tip="초점 해제" onClick={() => set('avatar', '')}>
                      <Eraser size={18} />
                    </button>
                  )}
                  {editing.thumbnail && (
                    <button
                      className="ptool danger"
                      data-tip="초상 소각"
                      onClick={() => set('thumbnail', '')}
                    >
                      <Flame size={18} />
                    </button>
                  )}
                </div>
              </div>
              <div className="char-hero-info hero-edit-info">
                <label className="hero-field">
                  <span className="hero-lab">성명</span>
                  <input
                    className="hero-inp"
                    value={editing.name}
                    onChange={(e) => set('name', e.target.value)}
                    onBlur={() => {
                      const en = nameDict[editing.name.trim()];
                      if (en && !editing.english_name?.trim()) set('english_name', en);
                    }}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">영문</span>
                  <input
                    className="hero-inp"
                    value={editing.english_name || ''}
                    onChange={(e) => set('english_name', e.target.value)}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">이명</span>
                  <input
                    className="hero-inp"
                    value={editing.aliases || ''}
                    onChange={(e) => set('aliases', e.target.value)}
                  />
                </label>
                <label className="hero-field">
                  <span className="hero-lab">거점</span>
                  <input
                    className="hero-inp"
                    value={editing.base || ''}
                    onChange={(e) => set('base', e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="char-view-body">
              <div className="info-grid">
                <div className="info-card">
                  <div className="info-card-title">신원</div>
                  <div className="edit-row">
                    <span className="edit-row-label">성별</span>
                    <Dropdown
                      value={editing.gender || ''}
                      options={[
                        { value: '남성', label: '남성' },
                        { value: '여성', label: '여성' },
                      ]}
                      onChange={(v) => set('gender', v)}
                      placeholder=""
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">소속</span>
                    <input
                      className="edit-inp"
                      value={editing.faction || ''}
                      onChange={(e) => set('faction', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">신분</span>
                    <input
                      className="edit-inp"
                      value={editing.rank || ''}
                      onChange={(e) => set('rank', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">문장</span>
                    <input
                      className="edit-inp"
                      value={editing.crest || ''}
                      onChange={(e) => set('crest', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">상태</span>
                    <Dropdown
                      value={editing.life_status || 'alive'}
                      options={[
                        { value: 'alive', label: '생존' },
                        { value: 'deceased', label: '사망' },
                        { value: 'unknown', label: '불명' },
                      ]}
                      onChange={(v) => set('life_status', v as Character['life_status'])}
                    />
                  </div>
                </div>
                <div className="info-card">
                  <div className="info-card-title">용모</div>
                  <div className="edit-row">
                    <span className="edit-row-label">신장</span>
                    <input
                      className="edit-inp"
                      value={editing.height || ''}
                      onChange={(e) => set('height', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">체격</span>
                    <input
                      className="edit-inp"
                      value={editing.build || ''}
                      onChange={(e) => set('build', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">모발</span>
                    <input
                      className="edit-inp"
                      value={editing.hair || ''}
                      onChange={(e) => set('hair', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">홍채</span>
                    <input
                      className="edit-inp"
                      value={editing.iris || ''}
                      onChange={(e) => set('iris', e.target.value)}
                    />
                  </div>
                  <div className="edit-row">
                    <span className="edit-row-label">인상</span>
                    <input
                      className="edit-inp"
                      value={editing.impression || ''}
                      onChange={(e) => set('impression', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="view-section">
                <div className="view-label">성향</div>
                <textarea
                  className="edit-area"
                  rows={4}
                  value={editing.personality || ''}
                  onChange={(e) => set('personality', e.target.value)}
                />
              </div>
              <div className="view-section">
                <div className="view-label">전법</div>
                <textarea
                  className="edit-area"
                  rows={3}
                  value={editing.combat || ''}
                  onChange={(e) => set('combat', e.target.value)}
                />
              </div>
              <div className="view-section">
                <div className="view-label">비고</div>
                <textarea
                  className="edit-area"
                  rows={3}
                  value={editing.notes || ''}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>

              <div className="view-section">
                <button
                  className={'bonds-head' + (editBondsOpen ? ' open' : '')}
                  onClick={() => setEditBondsOpen((o) => !o)}
                >
                  <span className="view-label">인연</span>
                  <ChevronDown size={18} className={'bonds-chev' + (editBondsOpen ? ' open' : '')} />
                </button>
                <div className={'bonds-wrap' + (editBondsOpen ? ' open' : '')}>
                  <div className="bonds-inner">
                {(editing.bonds || []).map((b, i) => (
                  <div className="bond-edit" key={i}>
                    <div className="bond-edit-top">
                      <label className="bond-f">
                        <span className="bond-flab">성명</span>
                        <input
                          className="edit-inp"
                          value={b.name}
                          onChange={(e) => updateBond(i, { name: e.target.value })}
                        />
                      </label>
                      <button className="bond-del" onClick={() => removeBond(i)} aria-label={UI.erase}>
                        <X size={16} />
                      </button>
                    </div>
                    <div className="bond-edit-row2">
                      <label className="bond-f">
                        <span className="bond-flab">관계</span>
                        <input
                          className="edit-inp"
                          value={b.category || ''}
                          onChange={(e) => updateBond(i, { category: e.target.value })}
                        />
                      </label>
                      <label className="bond-f">
                        <span className="bond-flab">상태</span>
                        <Dropdown
                          value={b.status || 'alive'}
                          options={[
                            { value: 'alive', label: '생존' },
                            { value: 'deceased', label: '사망' },
                            { value: 'unknown', label: '불명' },
                          ]}
                          onChange={(v) => updateBond(i, { status: v as Bond['status'] })}
                        />
                      </label>
                    </div>
                    <label className="bond-f">
                      <span className="bond-flab">설명</span>
                      <textarea
                        className="edit-area"
                        rows={2}
                        value={b.description || ''}
                        onChange={(e) => updateBond(i, { description: e.target.value })}
                      />
                    </label>
                  </div>
                ))}
                    <div className="add-foot">
                      <IconButton label="인연 추가" onClick={addBond}>
                        <Plus size={17} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </div>

              <div className="editor-actions">
                {editing.id && (
                  <button
                    className={'btn-erase' + (armed ? ' armed' : '')}
                    onClick={() => (armed ? remove() : setArmed(true))}
                    title={UI.erase}
                    aria-label={UI.erase}
                  >
                    <Trash2 size={18} />
                  </button>
                )}
                <div className="editor-actions-end">
                  <button onClick={() => setEditing(null)}>{UI.cancel}</button>
                  <button className="primary" onClick={save} disabled={saving}>
                    {saving ? <span className="spinner" /> : UI.save}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {cropping && editing?.thumbnail && (
          <FaceCrop
            src={editing.thumbnail}
            onDone={(url) => {
              set('avatar', url);
              setCropping(false);
            }}
            onCancel={() => setCropping(false)}
          />
        )}

        {importing && storyId != null && (
          <ImportDialog<Character>
            title={`명부 ${UI.import}`}
            endpoint="/api/characters"
            itemsKey="characters"
            payloadKey="character"
            currentStoryId={storyId}
            labelOf={(c) => c.name}
            subOf={(c) => splitAliases(c.aliases)[0] || c.faction || undefined}
            imageOf={(c) => c.avatar || c.thumbnail || LIST_PLACEHOLDER}
            fxOf={(c) => statusFx(c.life_status)}
            omit={['analysis', 'is_active', 'sort_order']}
            noun="인물"
            onClose={() => setImporting(false)}
            onDone={refresh}
          />
        )}
      </div>
    </div>
  );
}
