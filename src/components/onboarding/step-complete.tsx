"use client";

import { CheckCircle2, PartyPopper, Play, Upload, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface StepCompleteProps {
  organizationSlug: string;
  organizationName: string;
}

export function StepComplete({ organizationSlug, organizationName }: StepCompleteProps) {
  const quickActions = [
    {
      icon: Upload,
      title: "Upload your first video",
      description: "Share a screen recording or video update",
      href: `/${organizationSlug}/upload`,
      primary: true,
    },
    {
      icon: Users,
      title: "Invite your team",
      description: "Collaborate with teammates on videos",
      href: `/${organizationSlug}/settings/members`,
    },
    {
      icon: Play,
      title: "Take a quick tour",
      description: "Learn the basics in 2 minutes",
      href: `/${organizationSlug}?tour=true`,
    },
  ];

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-4">
        <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
          <PartyPopper className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">You're all set!</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Welcome to <span className="font-semibold text-foreground">{organizationName}</span>. Here's what you can do
          next.
        </p>
      </div>

      <div className="grid gap-4 max-w-xl mx-auto">
        {quickActions.map((action) => (
          <Card
            key={action.title}
            className={action.primary ? "border-primary/50 bg-primary/5" : "hover:border-primary/30 transition-colors"}
          >
            <CardContent className="p-0">
              <Link href={action.href} className="flex items-center gap-4 p-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    action.primary ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  <action.icon className="w-6 h-6" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">{action.title}</p>
                  <p className="text-sm text-muted-foreground">{action.description}</p>
                </div>
                <CheckCircle2 className={`w-5 h-5 ${action.primary ? "text-primary" : "text-muted-foreground/30"}`} />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="pt-4">
        <Button asChild size="lg" className="px-8">
          <Link href={`/${organizationSlug}`}>Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
