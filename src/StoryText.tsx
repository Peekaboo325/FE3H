import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypePodraScript } from './podraScript';

// 서술자 본문 = 마크다운 렌더 + 라틴(포드라 문자) 필기체.
export default function StoryText({ content }: { content: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypePodraScript]}>
      {content}
    </Markdown>
  );
}
