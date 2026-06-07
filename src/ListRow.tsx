import type { ReactNode } from 'react';

// 행(列) 리스트 한 줄 — 배너형. 초상이 왼쪽에서 번지듯(bleed) 깔리고, 이름이 옆에 온다.
// (썸네일 안에 가두지 않음 — 이미지를 마스크로 우측으로 흐려 행 배경에 녹인다.)
//  image 없으면(예: 문헌) 평범한 텍스트 행(--plain)으로 떨어진다.
export default function ListRow({
  image,
  name,
  sub,
  fx,
  selected = false,
  right,
  onClick,
}: {
  image?: string; // 초상(전체 이미지) URL — 없으면 텍스트 행
  name: string;
  sub?: string;
  fx?: string; // 상태 효과 클래스(fx-dead 등)
  selected?: boolean;
  right?: ReactNode; // 우측 슬롯(선택 체크 등)
  onClick?: () => void;
}) {
  return (
    <li
      className={'list-row' + (image ? '' : ' list-row--plain') + (selected ? ' selected' : '')}
      onClick={onClick}
    >
      {image && <img className={'list-row-img ' + (fx || '')} src={image} alt="" />}
      <div className="list-row-meta">
        <div className="list-row-name">{name}</div>
        {sub && <div className="list-row-sub">{sub}</div>}
      </div>
      {right && <span className="list-row-right">{right}</span>}
    </li>
  );
}
