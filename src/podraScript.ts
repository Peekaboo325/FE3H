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
