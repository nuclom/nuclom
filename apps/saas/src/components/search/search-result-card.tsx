'use client';

import type { SearchResult } from '@nuclom/lib/types';
import { Link } from '@vercel/microfrontends/next/client';
import { formatDistanceToNow } from 'date-fns';
import { FileText, Sparkles } from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SearchResultCardProps {
  result: SearchResult;
  organization: string;
}

export function SearchResultCard({ result, organization }: SearchResultCardProps) {
  const { video, rank, highlights } = result;

  // Function to render highlighted text safely
  const renderHighlight = (html: string | undefined) => {
    if (!html) return null;
    // Sanitize: only allow <mark> tags for search highlighting
    const sanitized = html.replace(/<(?!\/?(mark))[^>]+>/gi, '');
    return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
  };

  return (
    <Link href={`/org/${organization}/videos/${video.id}`} className="group block">
      <Card className="overflow-hidden hover:border-primary transition-colors">
        <CardContent className="p-0">
          <div className="flex gap-4 p-4">
            {/* Thumbnail */}
            <div className="relative w-48 flex-shrink-0">
              <div className="relative aspect-video overflow-hidden rounded-lg">
                <Image
                  src={video.thumbnailUrl || '/placeholder.svg'}
                  alt={video.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded-sm font-mono">
                  {video.duration}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Title */}
              <h3 className="font-semibold text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                {highlights?.title ? renderHighlight(highlights.title) : video.title}
              </h3>

              {/* Description or highlight */}
              {(highlights?.description || video.description) && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {highlights?.description ? renderHighlight(highlights.description) : video.description}
                </p>
              )}

              {/* Transcript highlight if available */}
              {highlights?.transcript && (
                <div className="text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1 line-clamp-2">
                  <span className="text-xs text-primary mr-1">Transcript:</span>
                  {renderHighlight(highlights.transcript)}
                </div>
              )}

              {/* Meta info */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {/* Author */}
                <div className="flex items-center gap-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={video.author.image || '/placeholder.svg'} alt={video.author.name || 'Author'} />
                    <AvatarFallback className="text-[10px]">
                      {video.author.name ? video.author.name.charAt(0) : 'A'}
                    </AvatarFallback>
                  </Avatar>
                  <span>{video.author.name}</span>
                </div>

                {/* Separator */}
                <span className="text-muted-foreground/50">•</span>

                {/* Date */}
                <span>{formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}</span>

                {/* Status badges */}
                <div className="flex items-center gap-1">
                  {video.transcript && (
                    <Badge variant="outline" className="text-xs h-5">
                      <FileText className="h-3 w-3 mr-1" />
                      Transcript
                    </Badge>
                  )}
                  {video.aiSummary && (
                    <Badge variant="outline" className="text-xs h-5">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI Summary
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tags if available */}
              {video.aiTags && video.aiTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {video.aiTags.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {video.aiTags.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{video.aiTags.length - 5} more
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Relevance indicator (only show if searching) */}
            {rank > 0 && (
              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-muted-foreground">Relevance</div>
                <div className="font-mono text-sm font-medium">{Math.round(rank * 100)}%</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
