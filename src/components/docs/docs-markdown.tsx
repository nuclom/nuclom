import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

interface DocsMarkdownProps {
  content: string;
}

export function DocsMarkdown({ content }: DocsMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeSlug]}
      components={{
        // Links - handle internal, external, and anchor links
        a: ({ href, children, ...props }) => {
          const isExternal = href?.startsWith('http');
          const isAnchor = href?.startsWith('#');

          if (isExternal) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          }

          if (isAnchor) {
            return (
              <a href={href} {...props}>
                {children}
              </a>
            );
          }

          // Handle relative markdown links - convert .md links to proper routes
          let processedHref = href || '';
          if (processedHref.endsWith('.md')) {
            processedHref = processedHref.replace(/\.md$/, '');
          }

          return (
            <Link href={processedHref} {...props}>
              {children}
            </Link>
          );
        },

        // Images - using native img for markdown content where src is dynamic
        img: ({ src, alt, ...props }) => (
          // biome-ignore lint/performance/noImgElement: dynamic src from markdown
          <img src={src} alt={alt || ''} {...props} />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
