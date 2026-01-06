import { ArrowRight, Bug, Sparkles, Zap } from 'lucide-react';
import Link from 'next/link';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type ChangelogEntry, changelog } from '@/lib/changelog';

function ChangeIcon({ type }: { type: 'feature' | 'improvement' | 'fix' }) {
  switch (type) {
    case 'feature':
      return <Sparkles className="w-4 h-4 text-purple-500" />;
    case 'improvement':
      return <Zap className="w-4 h-4 text-blue-500" />;
    case 'fix':
      return <Bug className="w-4 h-4 text-green-500" />;
  }
}

function ChangeBadge({ type }: { type: 'feature' | 'improvement' | 'fix' }) {
  const styles = {
    feature: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    improvement: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    fix: 'bg-green-500/10 text-green-600 border-green-500/20',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[type]}`}
    >
      <ChangeIcon type={type} />
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

function TimelineEntry({ entry, isLast }: { entry: ChangelogEntry; isLast: boolean }) {
  return (
    <div className="relative pl-8 pb-8">
      {/* Timeline line */}
      {!isLast && <div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-border" />}

      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary" />

      {/* Content */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <span className="text-sm text-muted-foreground shrink-0">{entry.date}</span>
        <ChangeBadge type={entry.type} />
        <span className="font-medium">{entry.title}</span>
      </div>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="w-3 h-3 mr-1" />
            What&apos;s New
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Changelog</h1>
          <p className="text-xl text-muted-foreground mb-8">
            All the latest updates, improvements, and fixes to Nuclom.
          </p>
          <Button asChild size="lg">
            <Link href="/features">
              Explore Features
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Changelog Timeline */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          {changelog.map((entry, index) => (
            <TimelineEntry key={`${entry.date}-${entry.title}`} entry={entry} isLast={index === changelog.length - 1} />
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-8">
            Join teams who are already using Nuclom to transform their video workflows.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
