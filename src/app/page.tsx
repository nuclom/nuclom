import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Check,
  Clock,
  Github,
  Globe,
  Lock,
  MessageSquare,
  Network,
  Play,
  Scissors,
  Share2,
  Shield,
  Sparkles,
  Star,
  Upload,
  Users,
  Video,
  Webhook,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />

        <div className="w-full max-w-7xl mx-auto relative z-10">
          <div className="flex items-center justify-center mb-6">
            <Badge variant="secondary" className="mb-4 px-4 py-2 text-sm font-medium">
              <Star className="w-4 h-4 mr-2" />
              Video Collaboration Platform
            </Badge>
          </div>

          <h2 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
            Collaborate on Videos
            <span className="text-primary block mt-2">Like Never Before</span>
          </h2>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Streamline your video workflow with real-time collaboration, AI-powered insights, and seamless sharing
            across teams and organizations.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
            <Button size="lg" asChild className="px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="px-8 py-6 text-lg">
              <Link href="/docs">View Documentation</Link>
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <span>Enterprise Security</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span>Lightning Fast</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <span>Global CDN</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              How It Works
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Get Started in Minutes</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From upload to collaboration, Nuclom makes video teamwork effortless
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg">
                1
              </div>
              <h4 className="text-xl font-semibold mb-3">Upload Your Videos</h4>
              <p className="text-muted-foreground">
                Drag and drop videos or import from your favorite cloud storage. We handle all the processing.
              </p>
              <Upload className="w-12 h-12 text-primary/20 mx-auto mt-6" />
            </div>

            <div className="relative text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg">
                2
              </div>
              <h4 className="text-xl font-semibold mb-3">Invite Your Team</h4>
              <p className="text-muted-foreground">
                Create organizations and invite team members. Control access with granular permissions.
              </p>
              <Users className="w-12 h-12 text-primary/20 mx-auto mt-6" />
            </div>

            <div className="relative text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg">
                3
              </div>
              <h4 className="text-xl font-semibold mb-3">Collaborate Together</h4>
              <p className="text-muted-foreground">
                Add time-stamped comments, share feedback, and track progress—all in one place.
              </p>
              <MessageSquare className="w-12 h-12 text-primary/20 mx-auto mt-6" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              Features
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Everything You Need</h3>
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
                <CardTitle className="text-xl mb-3">Smart Video Management</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Organize videos with channels, series, and collections. Track watch history and bookmark content.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Real-Time Collaboration</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Time-stamped comments, threaded discussions, @mentions, reactions, and real-time presence.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">AI-Powered Analysis</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Transcription, speaker diarization, summaries, chapters, and key moment detection.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Network className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Knowledge Graph</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Track decisions, link to GitHub PRs/issues, and build organizational knowledge from videos.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Scissors className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Clipping & Highlights</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Create clips from key moments, compile highlight reels, and generate shareable quote cards.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Enterprise Security</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  SSO/SAML, 2FA, passkeys, role-based access, audit logs, and GDPR compliance.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Share2 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Flexible Sharing</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Shareable links, password protection, embeddable players, and link expiration controls.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Webhook className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Powerful Integrations</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Zoom, Google Meet, Slack, Teams, GitHub, plus webhooks and comprehensive API access.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Analytics & Insights</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  View counts, watch time, engagement metrics, share analytics, and team activity tracking.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* View All Features Link */}
          <div className="mt-12 text-center">
            <Link href="/features" className="text-primary hover:underline font-medium inline-flex items-center gap-2">
              View all 50+ features
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="w-full max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <Badge variant="outline" className="px-4 py-2">
                <Sparkles className="w-4 h-4 mr-2" />
                AI-Powered
              </Badge>
              <h3 className="text-4xl md:text-5xl font-bold">Let AI Do the Heavy Lifting</h3>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Our AI understands your videos, generates accurate transcripts, identifies speakers, and extracts key
                moments—saving your team hours of manual work.
              </p>

              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Automatic Transcription</span>
                    <p className="text-sm text-muted-foreground">Accurate speech-to-text in multiple languages</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Speaker Diarization</span>
                    <p className="text-sm text-muted-foreground">Identify and label different speakers automatically</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Key Moment Detection</span>
                    <p className="text-sm text-muted-foreground">Auto-detect decisions, questions, and highlights</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Smart Summaries & Chapters</span>
                    <p className="text-sm text-muted-foreground">Get the key points with auto-generated chapters</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Action Item Extraction</span>
                    <p className="text-sm text-muted-foreground">Never miss a task or follow-up mentioned in videos</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Semantic Search</span>
                    <p className="text-sm text-muted-foreground">Find any moment by searching what was said</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center shadow-2xl">
                <div className="text-center">
                  <Bot className="w-20 h-20 text-primary mx-auto mb-4" />
                  <p className="text-lg font-medium text-primary">AI Analysis in Action</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              Integrations
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Works With Your Tools</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect Nuclom with the tools you already use for a seamless workflow
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Video className="w-8 h-8" />
                </div>
                <span className="font-medium">Zoom</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Video className="w-8 h-8" />
                </div>
                <span className="font-medium">Google Meet</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <span className="font-medium">Slack</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-8 h-8" />
                </div>
                <span className="font-medium">MS Teams</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Github className="w-8 h-8" />
                </div>
                <span className="font-medium">GitHub</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <span className="font-medium">SSO/SAML</span>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              Pricing
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Simple, Transparent Pricing</h3>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              Choose the plan that fits your team. Start with a 14-day free trial.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Pro Plan */}
            <Card className="relative border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">Pro</CardTitle>
                <CardDescription className="text-base">For growing teams</CardDescription>
                <div className="text-4xl font-bold mt-4">
                  $19
                  <span className="text-base font-normal text-muted-foreground">/user/month</span>
                </div>
                <p className="text-sm text-muted-foreground">billed annually ($25/mo if monthly)</p>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                  <div className="text-center">
                    <div className="font-semibold">10 GB/user</div>
                    <div className="text-muted-foreground text-xs">Storage</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold">25</div>
                    <div className="text-muted-foreground text-xs">Team members</div>
                  </div>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>AI transcription &amp; summaries</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Action item extraction</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>API access &amp; webhooks</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Zoom &amp; Google Meet import</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Email support</span>
                  </li>
                </ul>
                <Button className="w-full mt-6" variant="outline" asChild>
                  <Link href="/register">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="relative border-2 border-primary shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="px-4 py-1 bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader className="text-center pb-6 pt-8">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">Enterprise</CardTitle>
                <CardDescription className="text-base">For organizations at scale</CardDescription>
                <div className="text-4xl font-bold mt-4">
                  $41
                  <span className="text-base font-normal text-muted-foreground">/user/month</span>
                </div>
                <p className="text-sm text-muted-foreground">billed annually ($49/mo if monthly)</p>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                <div className="grid grid-cols-2 gap-2 p-3 bg-primary/10 rounded-lg text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-primary">Unlimited</div>
                    <div className="text-muted-foreground text-xs">Storage</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-primary">Unlimited</div>
                    <div className="text-muted-foreground text-xs">Team members</div>
                  </div>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span className="font-medium">Everything in Pro, plus:</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>SSO / SAML authentication</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Custom branding</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Priority support &amp; SLA</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Dedicated account manager</span>
                  </li>
                </ul>
                <Button className="w-full mt-6" asChild>
                  <Link href="/register?plan=enterprise">Start Free Trial</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* View Full Comparison */}
          <div className="mt-12 text-center">
            <Link href="/pricing" className="text-primary hover:underline font-medium inline-flex items-center gap-2">
              View detailed plan comparison
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              About
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Built for the Future of Video Collaboration</h3>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              We're reimagining how teams work with video content, making collaboration seamless and intuitive.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            <div className="space-y-6">
              <h4 className="text-3xl font-bold">Our Mission</h4>
              <p className="text-lg text-muted-foreground leading-relaxed">
                At Nuclom, we believe that video is the future of communication. Our platform removes the barriers that
                prevent teams from collaborating effectively on video content, enabling creativity and productivity like
                never before.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Whether you're a content creator, educator, or enterprise team, our tools adapt to your workflow and
                scale with your needs.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center shadow-xl">
                <Play className="w-16 h-16 text-primary" />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <h5 className="text-3xl font-bold mb-2">10,000+</h5>
              <p className="text-muted-foreground">Teams Worldwide</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Video className="w-10 h-10 text-primary" />
              </div>
              <h5 className="text-3xl font-bold mb-2">1M+</h5>
              <p className="text-muted-foreground">Videos Processed</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Globe className="w-10 h-10 text-primary" />
              </div>
              <h5 className="text-3xl font-bold mb-2">50+</h5>
              <p className="text-muted-foreground">Countries Served</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-primary" />
              </div>
              <h5 className="text-3xl font-bold mb-2">99.9%</h5>
              <p className="text-muted-foreground">Uptime SLA</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
        <div className="w-full max-w-7xl mx-auto relative z-10">
          <Badge variant="outline" className="mb-6 px-4 py-2">
            Ready to start?
          </Badge>
          <h3 className="text-4xl md:text-5xl font-bold mb-6">Ready to Transform Your Video Workflow?</h3>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Join thousands of teams already using Nuclom to collaborate more effectively
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button size="lg" asChild className="px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="px-8 py-6 text-lg">
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
