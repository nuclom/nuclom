import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Users,
  Video,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  Star,
} from "lucide-react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              Nuclom
            </h1>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="#about"
              className="text-sm font-medium hover:text-primary transition-colors"
            >
              About
            </Link>
          </nav>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="shadow-lg">
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />

        <div className="container mx-auto max-w-5xl relative z-10">
          <div className="flex items-center justify-center mb-6">
            <Badge
              variant="secondary"
              className="mb-4 px-4 py-2 text-sm font-medium"
            >
              <Star className="w-4 h-4 mr-2" />
              Video Collaboration Platform
            </Badge>
          </div>

          <h2 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
            Collaborate on Videos
            <span className="text-primary block mt-2">Like Never Before</span>
          </h2>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Streamline your video workflow with real-time collaboration,
            powerful editing tools, and seamless sharing across teams and
            workspaces.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
            <Button
              size="lg"
              asChild
              className="px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Link href="/signup">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="px-8 py-6 text-lg"
            >
              <Link href="#demo">Watch Demo</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 bg-muted/30">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              Features
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6">
              Everything You Need
            </h3>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Powerful features to transform your video collaboration workflow
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">
                  Smart Video Management
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Organize your videos with channels, series, and intelligent
                  categorization
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">
                  Team Collaboration
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Work together in real-time with comments, annotations, and
                  shared workspaces
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">
                  Enterprise Security
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Advanced permissions, secure sharing, and compliance-ready
                  infrastructure
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Lightning Fast</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Optimized performance with instant previews and seamless
                  streaming
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Globe className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Global Access</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Access your content anywhere with our global CDN and offline
                  sync
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Play className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">
                  Advanced Playback
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Professional-grade video player with custom controls and
                  analytics
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
        <div className="container mx-auto max-w-5xl relative z-10">
          <Badge variant="outline" className="mb-6 px-4 py-2">
            Ready to start?
          </Badge>
          <h3 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Video Workflow?
          </h3>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Join thousands of teams already using Nuclom to collaborate more
            effectively
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button
              size="lg"
              asChild
              className="px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all"
            >
              <Link href="/signup">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="px-8 py-6 text-lg"
            >
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-auto bg-muted/20">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-6 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                <Play className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Nuclom</span>
            </div>
            <div className="flex items-center space-x-8 text-sm text-muted-foreground">
              <Link
                href="/privacy"
                className="hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="hover:text-foreground transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/support"
                className="hover:text-foreground transition-colors"
              >
                Support
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2025 Nuclom. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
