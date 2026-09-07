'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { CSSProperties } from 'react';

export default function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div className="prose dark:prose-invert max-w-none text-sm text-black/80 dark:text-gray-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');

            if (!match) {
              return (
                <code className="bg-black/30 px-1 py-0.5 rounded text-xs" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <SyntaxHighlighter
                language={match[1]}
                style={vscDarkPlus}
                showLineNumbers={true}
                customStyle={
                  {
                    margin: 0,
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    backgroundColor: '#0d1117',
                  } as CSSProperties
                }
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}