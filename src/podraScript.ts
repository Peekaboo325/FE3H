// ─────────────────────────────────────────────────────────────────────────
//  본문 표현 도우미
//   1) rehypePodraScript — 마크다운 렌더 결과에서 라틴(=포드라 문자) 구간을
//      필기체(.script) span으로 감싼다. 코드/프리 블록 안은 건드리지 않음.
//   2) stripMarkdown — 복사용 평문(마크다운 기호 제거).
// ─────────────────────────────────────────────────────────────────────────

const LATIN = /([A-Za-z][A-Za-z '’\-]*[A-Za-z]|[A-Za-z])/g;

// hast 노드(타입은 느슨하게 any로 — 트리 변형만 한다).
/* eslint-disable @typescript-eslint/no-explicit-any */
function splitLatin(value: string): any[] {
  const out: any[] = [];
  for (const p of value.split(LATIN)) {
    if (p === '') continue;
    if (/[A-Za-z]/.test(p)) {
      out.push({
        type: 'element',
        tagName: 'span',
        properties: { className: ['script'] },
        children: [{ type: 'text', value: p }],
      });
    } else {
      out.push({ type: 'text', value: p });
    }
  }
  return out;
}

function walk(node: any, inCode: boolean) {
  if (!node || !Array.isArray(node.children)) return;
  const next: any[] = [];
  for (const child of node.children) {
    if (child.type === 'text' && !inCode) {
      next.push(...splitLatin(child.value));
    } else if (child.type === 'element' && child.tagName === 'hr') {
      // 구분선 → 장식 장면 구분(⁂)
      next.push({
        type: 'element',
        tagName: 'div',
        properties: { className: ['scene-break'] },
        children: [{ type: 'text', value: '⁂' }],
      });
    } else {
      if (child.type === 'element') {
        walk(child, inCode || child.tagName === 'code' || child.tagName === 'pre');
      }
      next.push(child);
    }
  }
  node.children = next;
}

export function rehypePodraScript() {
  return (tree: any) => walk(tree, false);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// 구분선(---) 안전망: 줄 단위 hr이 항상 thematicBreak가 되도록 앞뒤에 빈 줄을 보장.
// (날짜가 일반 텍스트로 나와도 '제목 밑줄(Setext)'로 먹히지 않게.) 코드블록 안은 건드리지 않음.
const HR_LINE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;
export function normalizeMarkdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (!inFence && HR_LINE.test(line)) {
      if (out.length && out[out.length - 1].trim() !== '') out.push('');
      out.push(line.trim());
      if (i + 1 < lines.length && lines[i + 1].trim() !== '') out.push('');
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}

// 마크다운 기호를 떼어 평문으로 (복사용).
export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '') // 제목
    .replace(/\*\*([^*]+)\*\*/g, '$1') // 굵게
    .replace(/\*([^*]+)\*/g, '$1') // 기울임
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1') // 인라인 코드
    .replace(/^>\s?/gm, '') // 인용
    .replace(/^\s*[-*+]\s+/gm, '') // 목록 글머리
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크
    .replace(/^\s*---+\s*$/gm, '') // 구분선
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
