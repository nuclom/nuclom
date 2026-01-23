'use client';

import { Link } from '@vercel/microfrontends/next/client';
import { ArrowRight, Check, MessageSquare, FileText, Github, Video, Sparkles } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Button } from '@/components/ui/button';
import {
  FadeInSection,
  SlideInLeft,
  SlideInRight,
  StaggerChildren,
  StaggerItem,
  GlowCard,
} from '@/components/motion/animated-section';

// Lazy load 3D components for performance
const KnowledgeNetwork = lazy(() =>
  import('@/components/three/knowledge-network').then((mod) => ({ default: mod.KnowledgeNetwork })),
);

const integrations = [
  { icon: MessageSquare, name: 'Slack', color: 'text-pink-400' },
  { icon: FileText, name: 'Notion', color: 'text-amber-400' },
  { icon: Github, name: 'GitHub', color: 'text-violet-400' },
  { icon: Video, name: 'Meetings', color: 'text-cyan-400' },
];

const valueProps = [
  {
    title: 'Find anything instantly',
    description: 'Search across all sources at once. AI understands context, not just keywords.',
  },
  {
    title: 'Never lose a decision',
    description: 'Automatically tracks decisions from Slack, meetings, and docs.',
  },
  {
    title: 'Know who knows what',
    description: 'AI maps expertise from contributions. Find the right person fast.',
  },
];

export function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* 3D Background */}
        <div className="absolute inset-0 z-0">
          <Suspense fallback={<div className="absolute inset-0 bg-gradient-hero" />}>
            <KnowledgeNetwork />
          </Suspense>
        </div>

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-hero z-5" />

        {/* Content */}
        <div className="relative z-20 w-full max-w-5xl mx-auto text-center">
          <FadeInSection>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-subtle text-sm text-muted-foreground mb-8">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Your organization's second brain</span>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.1}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6">
              <span className="text-gradient">Stop losing</span>
              <br />
              <span className="text-foreground">knowledge</span>
            </h1>
          </FadeInSection>

          <FadeInSection delay={0.2}>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Nuclom connects Slack, Notion, GitHub, and meetings into one searchable hub. AI surfaces what matters.
            </p>
          </FadeInSection>

          <FadeInSection delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                asChild
                className="px-8 py-6 text-lg glow-primary hover-glow transition-all duration-300"
              >
                <Link href="/register">
                  Start free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="px-8 py-6 text-lg glass-subtle hover:bg-white/5 transition-all"
              >
                <Link href="/docs">See how it works</Link>
              </Button>
            </div>
          </FadeInSection>

          {/* Integration icons */}
          <FadeInSection delay={0.4}>
            <div className="flex items-center justify-center gap-6 mt-16">
              {integrations.map((integration) => (
                <div
                  key={integration.name}
                  className="flex items-center gap-2 text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  <integration.icon className={`w-5 h-5 ${integration.color}`} />
                  <span className="text-sm hidden sm:inline">{integration.name}</span>
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20">
          <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex justify-center pt-2">
            <div className="w-1 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-grid opacity-30" />

        <div className="w-full max-w-6xl mx-auto relative">
          <FadeInSection>
            <div className="text-center mb-20">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Built for how teams actually work</h2>
              <p className="text-muted-foreground text-lg max-w-xl mx-auto">
                Knowledge lives everywhere. Nuclom brings it together.
              </p>
            </div>
          </FadeInSection>

          <StaggerChildren className="grid md:grid-cols-3 gap-8" staggerDelay={0.15}>
            {valueProps.map((prop, i) => (
              <StaggerItem key={prop.title}>
                <GlowCard className="h-full">
                  <div className="p-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                      <span className="text-2xl font-bold text-gradient">{i + 1}</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{prop.title}</h3>
                    <p className="text-muted-foreground">{prop.description}</p>
                  </div>
                </GlowCard>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial opacity-50" />

        <div className="w-full max-w-6xl mx-auto relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <SlideInLeft>
              <div className="space-y-6">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">
                  Connect once.
                  <br />
                  <span className="text-gradient">Search forever.</span>
                </h2>
                <p className="text-lg text-muted-foreground">
                  One-click OAuth connects your tools. AI processes everything automatically— transcribing meetings,
                  extracting decisions, mapping expertise.
                </p>

                <ul className="space-y-4 pt-4">
                  {[
                    'Semantic search understands intent',
                    'Cross-references related content',
                    'Highlights key decisions and owners',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary" />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </SlideInLeft>

            <SlideInRight>
              <div className="relative">
                {/* Mock UI showing connected sources */}
                <div className="glass rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>Connected Sources</span>
                    <span className="text-primary">4 active</span>
                  </div>

                  {integrations.map((integration, i) => (
                    <div
                      key={integration.name}
                      className="flex items-center justify-between p-4 rounded-xl bg-background/50 hover:bg-background/80 transition-colors"
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-white/5`}>
                          <integration.icon className={`w-5 h-5 ${integration.color}`} />
                        </div>
                        <span className="font-medium">{integration.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm text-muted-foreground">Synced</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Decorative glow */}
                <div className="absolute -inset-4 bg-gradient-to-r from-violet-500/20 via-cyan-500/20 to-pink-500/20 rounded-3xl blur-3xl -z-10" />
              </div>
            </SlideInRight>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-32 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl mx-auto">
          <FadeInSection>
            <div className="glass rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">Start with 14 days free</h2>
                <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
                  Plans from $19/user/month. No credit card required to start.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" asChild className="glow-primary">
                    <Link href="/register">
                      Start free trial
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="ghost" asChild>
                    <Link href="/pricing">View pricing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-gradient-hero" />

        <div className="w-full max-w-4xl mx-auto text-center relative">
          <FadeInSection>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6">
              Ready to stop losing
              <br />
              <span className="text-gradient">institutional knowledge?</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
              Join teams who've made their organization's knowledge searchable and actionable.
            </p>

            <Button size="lg" asChild className="px-10 py-7 text-xl glow-primary hover-glow animate-glow">
              <Link href="/register">
                Get started
                <ArrowRight className="ml-2 w-6 h-6" />
              </Link>
            </Button>
          </FadeInSection>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
