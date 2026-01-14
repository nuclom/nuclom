'use client';

import { List } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface DocsTocProps {
  className?: string;
}

export function DocsToc({ className }: DocsTocProps) {
  const [headings, setHeadings] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Find all headings in the docs content
    const content = document.querySelector('[data-docs-content]');
    if (!content) return;

    const elements = content.querySelectorAll('h2, h3');
    const items: TocItem[] = [];

    elements.forEach((element) => {
      const text = element.textContent || '';
      // Create an ID from the heading text if not present
      let id = element.id;
      if (!id) {
        id = text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        element.id = id;
      }

      items.push({
        id,
        text,
        level: element.tagName === 'H2' ? 2 : 3,
      });
    });

    setHeadings(items);

    // Set up intersection observer for active heading
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      {
        rootMargin: '-80px 0px -80% 0px',
      },
    );

    for (const element of elements) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, []);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
        <List className="h-4 w-4" />
        On this page
      </div>

      <ul className="space-y-1">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault();
                const element = document.getElementById(heading.id);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                  setActiveId(heading.id);
                  // Update URL without reload
                  window.history.pushState(null, '', `#${heading.id}`);
                }
              }}
              className={cn(
                'block text-sm py-1 transition-colors',
                heading.level === 3 && 'pl-3',
                activeId === heading.id ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
