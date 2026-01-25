'use client';

import { Button } from '@nuclom/ui/button';
import { ArrowRight } from 'lucide-react';

interface FollowUpChipsProps {
  questions: string[];
  onClick: (question: string) => void;
}

export function FollowUpChips({ questions, onClick }: FollowUpChipsProps) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Follow-up questions</h4>
      <div className="flex flex-wrap gap-2">
        {questions.map((question, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-auto py-1.5 px-3 text-xs font-normal text-left justify-start"
            onClick={() => onClick(question)}
          >
            <ArrowRight className="h-3 w-3 mr-1.5 shrink-0" />
            <span className="line-clamp-1">{question}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
