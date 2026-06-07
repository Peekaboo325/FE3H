import type { ReactNode } from 'react';

// 행(列) 리스트 한 줄 — 둥근 얼굴(초점 크롭) + 이름(+부가) + 우측 슬롯.
// 카드 갤러리와 짝을 이루는 '행 정렬' 공용 자산. 명부 반입 등에서 쓴다.
//  avatar 없으면(예: 문헌) 얼굴 칸을 생략해 텍스트 행으로 떨어진다.
export default function ListRow({
  avatar,
  name,
  sub,
  fx,
  selected = false,
  right,
  onClick,
}: {
  avatar?: string; // 얼굴(초점 크롭) URL — 없으면 얼굴 칸 생략
  name: string;
  sub?: string;
  fx?: string; // 상태 효과 클래스(fx-dead 등)
  selected?: boolean;
  right?: ReactNode; // 우측 슬롯(선택 체크 등)
  onClick?: () => void;
}) {
  return (
    <li className={'list-row' + (selected ? ' selected' : '')} onClick={onClick}>
      {avatar && (
        <span className="list-row-av">
          <img className={fx} src={avatar} alt="" />
        </span>
      )}
      <div className="list-row-meta">
        <div className="list-row-name">{name}</div>
        {sub && <div className="list-row-sub">{sub}</div>}
      </div>
      {right && <span className="list-row-right">{right}</span>}
    </li>
  );
}
