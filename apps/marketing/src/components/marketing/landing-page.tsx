import { Link } from '@vercel/microfrontends/next/client';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  Check,
  FileText,
  Github,
  Globe,
  Layers,
  Link2,
  Lock,
  MessageSquare,
  Network,
  Search,
  Share2,
  Shield,
  Sparkles,
  Star,
  Users,
  Video,
  Webhook,
  Zap,
} from 'lucide-react';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LandingPage() {
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
              Unified Knowledge Hub
            </Badge>
          </div>

          <h2 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
            All Your Knowledge
            <span className="text-primary block mt-2">One Intelligent Hub</span>
          </h2>

          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Aggregate knowledge from Slack, Notion, GitHub, and videos. AI-powered insights surface decisions,
            track expertise, and connect ideas across your entire organization.
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
              <Brain className="w-5 h-5 text-primary" />
              <span>AI-Powered</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <span>Multi-Source</span>
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
              Connect your sources, let AI process the content, and discover insights across everything
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg">
                1
              </div>
              <h4 className="text-xl font-semibold mb-3">Connect Your Sources</h4>
              <p className="text-muted-foreground">
                Link Slack workspaces, Notion sites, GitHub repos, and upload videos. One-click OAuth setup.
              </p>
              <Link2 className="w-12 h-12 text-primary/20 mx-auto mt-6" />
            </div>

            <div className="relative text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg">
                2
              </div>
              <h4 className="text-xl font-semibold mb-3">AI Processes Everything</h4>
              <p className="text-muted-foreground">
                Content is automatically synced, analyzed, and connected. Decisions, topics, and expertise emerge.
              </p>
              <Brain className="w-12 h-12 text-primary/20 mx-auto mt-6" />
            </div>

            <div className="relative text-center">
              <div className="w-16 h-16 bg-primary text-primary-foreground rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold shadow-lg">
                3
              </div>
              <h4 className="text-xl font-semibold mb-3">Discover & Search</h4>
              <p className="text-muted-foreground">
                Find any knowledge instantly. See who knows what. Track decisions across all sources.
              </p>
              <Search className="w-12 h-12 text-primary/20 mx-auto mt-6" />
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
              Powerful features to unify and unlock your organization's knowledge
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Slack Integration</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Sync conversations, threads, and announcements. Capture decisions made in real-time discussions.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Notion Integration</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Connect wikis, project notes, and documentation. Keep your knowledge graph in sync with your docs.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Github className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">GitHub Integration</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Index PRs, issues, and discussions. Link code decisions to conversations and documentation.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Video & Meetings</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Upload recordings, import from Zoom and Meet. AI transcription extracts every insight.
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
                  Auto-discover relationships between content. See how ideas connect across all your sources.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Decision Tracking</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Never lose a decision again. Track rationale, participants, and outcomes across all channels.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Expertise Mapping</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Discover who knows what. AI identifies subject matter experts from their contributions.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg bg-background/50 backdrop-blur hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Search className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="text-xl mb-3">Unified Search</CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Search across all sources at once. Semantic search understands what you mean, not just keywords.
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
                  SSO/SAML, encrypted credentials, role-based access, audit logs, and GDPR compliance.
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
              <h3 className="text-4xl md:text-5xl font-bold">Let AI Connect the Dots</h3>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Our AI processes content from every source, discovers relationships, extracts decisions, and builds
                a living knowledge graph that grows smarter over time.
              </p>

              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Cross-Source Analysis</span>
                    <p className="text-sm text-muted-foreground">Connect insights from Slack, Notion, GitHub, and videos</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Auto Topic Clustering</span>
                    <p className="text-sm text-muted-foreground">Automatically group related content into topics</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Decision Extraction</span>
                    <p className="text-sm text-muted-foreground">Surface decisions from meetings, chats, and documents</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Expertise Detection</span>
                    <p className="text-sm text-muted-foreground">Know who to ask based on contribution history</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Smart Summaries</span>
                    <p className="text-sm text-muted-foreground">Get digests of activity across your organization</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-medium">Semantic Search</span>
                    <p className="text-sm text-muted-foreground">Find knowledge by meaning, not just keywords</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center shadow-2xl">
                <div className="text-center">
                  <Bot className="w-20 h-20 text-primary mx-auto mb-4" />
                  <p className="text-lg font-medium text-primary">Knowledge Intelligence</p>
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
              Knowledge Sources
            </Badge>
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Connect Where Your Team Works</h3>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              One-click OAuth to connect your knowledge sources. Automatic sync keeps everything up to date.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            <Card className="border-2 border-primary hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-primary" />
                </div>
                <span className="font-medium">Slack</span>
                <span className="text-xs text-muted-foreground mt-1">Conversations</span>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <span className="font-medium">Notion</span>
                <span className="text-xs text-muted-foreground mt-1">Documentation</span>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                  <Github className="w-8 h-8 text-primary" />
                </div>
                <span className="font-medium">GitHub</span>
                <span className="text-xs text-muted-foreground mt-1">Code & Issues</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Video className="w-8 h-8" />
                </div>
                <span className="font-medium">Videos</span>
                <span className="text-xs text-muted-foreground mt-1">Meetings</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Webhook className="w-8 h-8" />
                </div>
                <span className="font-medium">Webhooks</span>
                <span className="text-xs text-muted-foreground mt-1">Real-time</span>
              </CardContent>
            </Card>

            <Card className="border hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardContent className="flex flex-col items-center justify-center py-8">
                <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center mb-4">
                  <Globe className="w-8 h-8" />
                </div>
                <span className="font-medium">API</span>
                <span className="text-xs text-muted-foreground mt-1">Custom</span>
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
            {/* Scale Plan */}
            <Card className="relative border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="text-center pb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">Scale</CardTitle>
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
                    <div className="font-semibold">5 GB/user</div>
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
                    <span>3 knowledge sources</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>AI processing &amp; summaries</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Unified search</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Decision tracking</span>
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

            {/* Pro Plan */}
            <Card className="relative border-2 border-primary shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="px-4 py-1 bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader className="text-center pb-6 pt-8">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl mb-2">Pro</CardTitle>
                <CardDescription className="text-base">For organizations at scale</CardDescription>
                <div className="text-4xl font-bold mt-4">
                  $39
                  <span className="text-base font-normal text-muted-foreground">/user/month</span>
                </div>
                <p className="text-sm text-muted-foreground">billed annually ($45/mo if monthly)</p>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                <div className="grid grid-cols-2 gap-2 p-3 bg-primary/10 rounded-lg text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-primary">25 GB/user</div>
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
                    <span className="font-medium">Everything in Scale, plus:</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Unlimited knowledge sources</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>SSO / SAML authentication</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Knowledge graph analytics</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-primary" />
                    <span>Priority support &amp; SLA</span>
                  </li>
                </ul>
                <Button className="w-full mt-6" asChild>
                  <Link href="/register?plan=pro">Start Free Trial</Link>
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
            <h3 className="text-4xl md:text-5xl font-bold mb-6">Built for the Future of Knowledge Work</h3>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto">
              We're reimagining how teams capture, organize, and discover organizational knowledge.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
            <div className="space-y-6">
              <h4 className="text-3xl font-bold">Our Mission</h4>
              <p className="text-lg text-muted-foreground leading-relaxed">
                At Nuclom, we believe that organizational knowledge is scattered across too many tools. Decisions get
                lost in Slack threads, context lives in Notion pages, discussions happen on GitHub, and meetings are
                forgotten.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We're building the unified knowledge layer that connects everything, surfaces insights, and ensures
                your team never loses institutional knowledge again.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center shadow-xl">
                <Network className="w-16 h-16 text-primary" />
              </div>
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
          <h3 className="text-4xl md:text-5xl font-bold mb-6">Ready to Unify Your Organization's Knowledge?</h3>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto">
            Connect your first source in minutes. Start discovering insights today.
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
