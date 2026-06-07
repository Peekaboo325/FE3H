import { Fragment, type ReactNode } from 'react';

// 가벼운 마크다운 렌더러 (의존성 없음).
//  지원: **굵게**, *기울임*/_기울임_, "- " 불릿 목록, 빈 줄=문단 / 단일 줄바꿈.
//  (성향·전법·비고 같은 자유서술 칸 표시용)

// 한 줄 안의 굵게/기울임/(괄호) 처리.  (괄호)는 작고 연하게 — 부연 설명 톤.
function inline(text: string, kp: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\([^)]*\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) nodes.push(<strong key={kp + i}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('('))
      nodes.push(
        <span className="paren-dim" key={kp + i}>
          {tok}
        </span>,
      );
    else nodes.push(<em key={kp + i}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text }: { text: string }) {
  const lines = (text ?? '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const isBullet = (s: string) => /^\s*-\s+/.test(s);

  while (i < lines.length) {
    if (isBullet(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ''));
        i++;
      }
      blocks.push(
        <ul className="md-list" key={key++}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `b${key}-${j}-`)}</li>
          ))}
        </ul>,
      );
    } else if (lines[i].trim() === '') {
      i++; // 빈 줄 = 문단 구분
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !isBullet(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      blocks.push(
        <p className="md-p" key={key++}>
          {para.map((ln, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {inline(ln, `p${key}-${j}-`)}
            </Fragment>
          ))}
        </p>,
      );
    }
  }
  return <>{blocks}</>;
}
