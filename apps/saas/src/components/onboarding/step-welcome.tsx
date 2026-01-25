'use client';

import { Button } from '@nuclom/ui/button';
import { Card, CardContent } from '@nuclom/ui/card';
import { Building2, Rocket, Sparkles, Users, Video } from 'lucide-react';

interface StepWelcomeProps {
  userName?: string;
  onNext: () => void;
}

export function StepWelcome({ userName, onNext }: StepWelcomeProps) {
  const features = [
    {
      icon: Video,
      title: 'Record & Upload',
      description: 'Share screen recordings and video updates with your team',
    },
    {
      icon: Users,
      title: 'Collaborate',
      description: 'Comment, react, and discuss videos with timestamps',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered',
      description: 'Get automatic transcripts, summaries, and action items',
    },
  ];

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
          <Rocket className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome{userName ? `, ${userName}` : ''}! 👋</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Nuclom helps your team communicate better with async video. Let's get you set up in just a few minutes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title} className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-4">
        <Button size="lg" onClick={onNext} className="px-8">
          Get Started
          <Building2 className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
