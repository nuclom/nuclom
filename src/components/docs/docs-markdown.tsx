import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import Link from "next/link";

interface DocsMarkdownProps {
  content: string;
}

export function DocsMarkdown({ content }: DocsMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // Custom heading components with anchor links
        h1: ({ children, ...props }) => (
          <h1 className="scroll-m-20 text-4xl font-bold tracking-tight lg:text-5xl" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }) => (
          <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0 mt-10" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }) => (
          <h3 className="scroll-m-20 text-2xl font-semibold tracking-tight mt-8" {...props}>
            {children}
          </h3>
        ),
        h4: ({ children, ...props }) => (
          <h4 className="scroll-m-20 text-xl font-semibold tracking-tight mt-6" {...props}>
            {children}
          </h4>
        ),
        h5: ({ children, ...props }) => (
          <h5 className="scroll-m-20 text-lg font-semibold tracking-tight mt-4" {...props}>
            {children}
          </h5>
        ),
        h6: ({ children, ...props }) => (
          <h6 className="scroll-m-20 text-base font-semibold tracking-tight mt-4" {...props}>
            {children}
          </h6>
        ),

        // Paragraph
        p: ({ children, ...props }) => (
          <p className="leading-7 [&:not(:first-child)]:mt-4" {...props}>
            {children}
          </p>
        ),

        // Links
        a: ({ href, children, ...props }) => {
          const isExternal = href?.startsWith("http");
          const isAnchor = href?.startsWith("#");

          if (isExternal) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                {...props}
              >
                {children}
              </a>
            );
          }

          if (isAnchor) {
            return (
              <a href={href} className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" {...props}>
                {children}
              </a>
            );
          }

          // Handle relative markdown links - convert .md links to proper routes
          let processedHref = href || "";
          if (processedHref.endsWith(".md")) {
            processedHref = processedHref.replace(/\.md$/, "");
          }

          return (
            <Link
              href={processedHref}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
              {...props}
            >
              {children}
            </Link>
          );
        },

        // Lists
        ul: ({ children, ...props }) => (
          <ul className="my-4 ml-6 list-disc [&>li]:mt-2" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="my-4 ml-6 list-decimal [&>li]:mt-2" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => (
          <li className="leading-7" {...props}>
            {children}
          </li>
        ),

        // Code blocks
        pre: ({ children, ...props }) => (
          <pre className="mb-4 mt-4 overflow-x-auto rounded-lg border bg-muted p-4" {...props}>
            {children}
          </pre>
        ),
        code: ({ className, children, ...props }) => {
          const isInline = !className;

          if (isInline) {
            return (
              <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold" {...props}>
                {children}
              </code>
            );
          }

          return (
            <code className={`${className} font-mono text-sm`} {...props}>
              {children}
            </code>
          );
        },

        // Blockquotes
        blockquote: ({ children, ...props }) => (
          <blockquote className="mt-6 border-l-2 pl-6 italic" {...props}>
            {children}
          </blockquote>
        ),

        // Tables
        table: ({ children, ...props }) => (
          <div className="my-6 w-full overflow-y-auto">
            <table className="w-full" {...props}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }) => (
          <thead className="border-b" {...props}>
            {children}
          </thead>
        ),
        tbody: ({ children, ...props }) => (
          <tbody {...props}>{children}</tbody>
        ),
        tr: ({ children, ...props }) => (
          <tr className="m-0 border-t p-0 even:bg-muted" {...props}>
            {children}
          </tr>
        ),
        th: ({ children, ...props }) => (
          <th className="border px-4 py-2 text-left font-bold [&[align=center]]:text-center [&[align=right]]:text-right" {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }) => (
          <td className="border px-4 py-2 text-left [&[align=center]]:text-center [&[align=right]]:text-right" {...props}>
            {children}
          </td>
        ),

        // Horizontal rule
        hr: ({ ...props }) => <hr className="my-8" {...props} />,

        // Images
        img: ({ src, alt, ...props }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt || ""} className="rounded-lg border my-4" {...props} />
        ),

        // Strong/Bold
        strong: ({ children, ...props }) => (
          <strong className="font-semibold" {...props}>
            {children}
          </strong>
        ),

        // Emphasis/Italic
        em: ({ children, ...props }) => (
          <em className="italic" {...props}>
            {children}
          </em>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
