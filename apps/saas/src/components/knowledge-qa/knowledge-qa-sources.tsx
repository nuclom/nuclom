'use client';

import { cn } from '@nuclom/lib/utils';
import { ExternalLink, FileText, GitBranch, MessageSquare, Video } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface QASource {
  contentId: string;
  type: 'content_item' | 'decision' | 'transcript_chunk';
  title: string;
  similarity: number;
  excerpt: string;
  sourceType?: string;
  url?: string;
}

interface KnowledgeQASourcesProps {
  sources: QASource[];
}

const sourceTypeIcons: Record<string, React.ElementType> = {
  slack: MessageSquare,
  notion: FileText,
  github: GitBranch,
  video: Video,
  decision: FileText,
  transcript_chunk: Video,
};

const sourceTypeLabels: Record<string, string> = {
  slack: 'Slack',
  notion: 'Notion',
  github: 'GitHub',
  video: 'Video',
  decision: 'Decision',
  content_item: 'Document',
  transcript_chunk: 'Transcript',
};

export function KnowledgeQASources({ sources }: KnowledgeQASourcesProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sources</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sources.map((source, index) => {
          const Icon = sourceTypeIcons[source.sourceType || source.type] || FileText;
          const typeLabel = sourceTypeLabels[source.sourceType || source.type] || 'Source';
          const relevancePercent = Math.round(source.similarity * 100);

          return (
            <TooltipProvider key={`${source.contentId}-${index}`}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <div
                          className={cn(
                            'shrink-0 rounded-md p-1.5',
                            source.sourceType === 'slack' &&
                              'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
                            source.sourceType === 'notion' &&
                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                            source.sourceType === 'github' &&
                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                            source.sourceType === 'video' &&
                              'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
                            !source.sourceType && 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium truncate">{source.title}</span>
                            {source.url && (
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">{typeLabel}</span>
                            <span
                              className={cn(
                                'text-[10px] font-medium',
                                relevancePercent >= 80 && 'text-green-600 dark:text-green-400',
                                relevancePercent >= 60 &&
                                  relevancePercent < 80 &&
                                  'text-yellow-600 dark:text-yellow-400',
                                relevancePercent < 60 && 'text-orange-600 dark:text-orange-400',
                              )}
                            >
                              {relevancePercent}% match
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm">
                  <p className="text-xs">{source.excerpt || 'No excerpt available'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
