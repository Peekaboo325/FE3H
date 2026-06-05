import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple parser to handle code blocks and paragraphs. 
  // For a production app, use 'react-markdown', but this avoids external dependencies for this generation task.
  
  const renderContent = () => {
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Extract code content and language
        const contentWithoutTicks = part.slice(3, -3);
        const firstLineBreak = contentWithoutTicks.indexOf('\n');
        let language = 'text';
        let code = contentWithoutTicks;

        if (firstLineBreak > -1) {
          const possibleLang = contentWithoutTicks.substring(0, firstLineBreak).trim();
          if (possibleLang && !possibleLang.includes(' ')) {
             language = possibleLang;
             code = contentWithoutTicks.substring(firstLineBreak + 1);
          }
        }

        return (
          <div key={index} className="my-4 rounded-lg overflow-hidden bg-slate-950 border border-slate-800">
            <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800/50 border-b border-slate-800">
              <span className="text-xs font-mono text-slate-400 lowercase">{language}</span>
              <span className="text-xs text-slate-500">Copy</span>
            </div>
            <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }
      
      // Handle inline bold and basic paragraphs
      return (
        <div key={index} className="whitespace-pre-wrap leading-7">
           {part.split('\n').map((line, i) => (
             <React.Fragment key={i}>
                {parseInline(line)}
                {i < part.split('\n').length - 1 && <br />}
             </React.Fragment>
           ))}
        </div>
      );
    });
  };

  const parseInline = (text: string) => {
    // Very basic bold parser
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-100">{part.slice(2, -2)}</strong>;
      }
      // Inline code
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((subPart, j) => {
         if (subPart.startsWith('`') && subPart.endsWith('`')) {
            return <code key={`${i}-${j}`} className="bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-cyan-400">{subPart.slice(1,-1)}</code>;
         }
         return <span key={`${i}-${j}`}>{subPart}</span>;
      });
    });
  };

  return <div className="markdown-body">{renderContent()}</div>;
};

export default MarkdownRenderer;
