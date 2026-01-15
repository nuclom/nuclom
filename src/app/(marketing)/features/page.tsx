import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Clock,
  Code,
  FileText,
  FolderOpen,
  Github,
  Globe,
  Key,
  Layers,
  Layout,
  Lightbulb,
  Link2,
  Lock,
  MessageSquare,
  Mic,
  Network,
  Palette,
  Play,
  Scissors,
  Search,
  Settings,
  Share2,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Video,
  Webhook,
} from 'lucide-react';
import Link from 'next/link';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const featureCategories = [
  {
    id: 'ai-insights',
    title: 'AI-Powered Insights',
    description: 'Let AI understand your videos and extract valuable insights automatically',
    icon: Brain,
    color: 'from-purple-500/20 to-purple-500/5',
    features: [
      {
        icon: Mic,
        title: 'Automatic Transcription',
        description:
          'Convert video audio to accurate, searchable text using state-of-the-art speech recognition with support for multiple languages.',
      },
      {
        icon: Users,
        title: 'Speaker Diarization',
        description:
          'Automatically identify and label different speakers in your videos, making it easy to follow who said what.',
      },
      {
        icon: FileText,
        title: 'Smart Summaries',
        description:
          'Get AI-generated summaries that capture the key points of any video, saving hours of review time.',
      },
      {
        icon: BookOpen,
        title: 'Automatic Chapters',
        description:
          'Videos are automatically divided into logical chapters with timestamps and summaries for easy navigation.',
      },
      {
        icon: Lightbulb,
        title: 'Action Item Extraction',
        description:
          'Never miss a task or follow-up. AI automatically identifies and extracts action items from meeting recordings.',
      },
      {
        icon: Star,
        title: 'Key Moment Detection',
        description:
          'Automatically identify important moments like decisions, questions, answers, and highlights in your videos.',
      },
      {
        icon: Code,
        title: 'Code Snippet Detection',
        description: 'Identify and extract code snippets mentioned in technical videos for easy reference and sharing.',
      },
      {
        icon: Search,
        title: 'Semantic Search',
        description:
          'Find any moment by searching what was said. AI understands context and meaning, not just keywords.',
      },
    ],
  },
  {
    id: 'knowledge-graph',
    title: 'Knowledge Graph & Decisions',
    description: 'Build an organizational knowledge base from your video content',
    icon: Network,
    color: 'from-blue-500/20 to-blue-500/5',
    features: [
      {
        icon: Lightbulb,
        title: 'Decision Tracking',
        description:
          'Automatically capture and track decisions made during video discussions with full context and participants.',
      },
      {
        icon: Network,
        title: 'Knowledge Nodes',
        description:
          'Create interconnected knowledge entities linking people, topics, artifacts, decisions, and videos.',
      },
      {
        icon: Link2,
        title: 'External Links',
        description:
          'Connect decisions to external entities like GitHub PRs, issues, code files, and documents for full traceability.',
      },
      {
        icon: Clock,
        title: 'Decision Timeline',
        description:
          'View when decisions were made in relation to video timeline, providing historical context for your team.',
      },
    ],
  },
  {
    id: 'collaboration',
    title: 'Team Collaboration',
    description: 'Work together seamlessly on video content with your team',
    icon: Users,
    color: 'from-green-500/20 to-green-500/5',
    features: [
      {
        icon: Share2,
        title: 'Smart Sharing',
        description:
          'Share videos with your team or external viewers. Control access with granular permissions and expiration.',
      },
      {
        icon: Bell,
        title: 'Notifications & Alerts',
        description:
          'Stay informed about new videos, processing completion, and team activity with customizable notifications.',
      },
      {
        icon: Users,
        title: 'Real-Time Presence',
        description: "See who's currently watching or working on videos. Collaborate in real-time with your team.",
      },
      {
        icon: Share2,
        title: 'Activity Feed',
        description: 'Track team activity and engagement across all videos and channels in a unified activity stream.',
      },
    ],
  },
  {
    id: 'video-management',
    title: 'Video Management',
    description: 'Organize, search, and manage your video library with ease',
    icon: Video,
    color: 'from-orange-500/20 to-orange-500/5',
    features: [
      {
        icon: FolderOpen,
        title: 'Channels & Collections',
        description:
          'Organize videos into channels for different teams, projects, or topics. Create collections for easy access.',
      },
      {
        icon: Layers,
        title: 'Video Series',
        description:
          'Create ordered playlists with viewer progress tracking. Perfect for training, onboarding, and tutorials.',
      },
      {
        icon: Search,
        title: 'Full-Text Search',
        description:
          'Search across transcripts, titles, descriptions, and metadata. Find any video or moment instantly.',
      },
      {
        icon: BarChart3,
        title: 'Video Analytics',
        description: 'Track view counts, watch time, engagement metrics, and viewer behavior for all your videos.',
      },
      {
        icon: Clock,
        title: 'Watch History',
        description: "Keep track of what you've watched and pick up where you left off. Never lose your progress.",
      },
      {
        icon: BookOpen,
        title: 'Watch Later',
        description: 'Bookmark videos to watch later. Build your personal queue of content to review.',
      },
    ],
  },
  {
    id: 'clipping',
    title: 'Clipping & Content Creation',
    description: 'Create clips, highlights, and shareable content from your videos',
    icon: Scissors,
    color: 'from-pink-500/20 to-pink-500/5',
    features: [
      {
        icon: Scissors,
        title: 'Automatic Clips',
        description: 'AI automatically creates clips from key moments, decisions, and highlights in your videos.',
      },
      {
        icon: Play,
        title: 'Manual Clipping',
        description: 'Create custom clips with precise timestamps. Trim and export exactly the content you need.',
      },
      {
        icon: Layers,
        title: 'Highlight Reels',
        description:
          'Compile multiple clips into highlight videos. Perfect for summaries, training, and presentations.',
      },
      {
        icon: Star,
        title: 'Key Moment Export',
        description: 'Export important moments as standalone clips. Perfect for sharing insights and decisions.',
      },
    ],
  },
  {
    id: 'sharing',
    title: 'Sharing & Embedding',
    description: 'Share videos securely with anyone, anywhere',
    icon: Share2,
    color: 'from-cyan-500/20 to-cyan-500/5',
    features: [
      {
        icon: Link2,
        title: 'Shareable Links',
        description: 'Generate public or private shareable links for any video. Control who can access your content.',
      },
      {
        icon: Lock,
        title: 'Password Protection',
        description: 'Add password protection to shared videos for an extra layer of security on sensitive content.',
      },
      {
        icon: Layout,
        title: 'Embeddable Videos',
        description: 'Embed videos on external websites, documentation, or internal tools with customizable players.',
      },
      {
        icon: Clock,
        title: 'Link Expiration',
        description: 'Set expiration dates on share links. Perfect for time-sensitive content and external reviews.',
      },
      {
        icon: BarChart3,
        title: 'Share Analytics',
        description: "Track views and engagement on shared content. Know who's watching and how they're engaging.",
      },
    ],
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect with the tools you already use',
    icon: Webhook,
    color: 'from-indigo-500/20 to-indigo-500/5',
    features: [
      {
        icon: Video,
        title: 'Zoom Integration',
        description: 'Automatically import and process Zoom recordings. Sync meeting metadata and participants.',
      },
      {
        icon: Video,
        title: 'Google Meet',
        description: 'Import Google Meet recordings directly from Google Drive with full meeting context.',
      },
      {
        icon: MessageSquare,
        title: 'Slack Integration',
        description:
          'Share videos and receive notifications in Slack channels. Collaborate where your team already works.',
      },
      {
        icon: Users,
        title: 'Microsoft Teams',
        description: 'Integrate with Teams channels for seamless video sharing and collaboration.',
      },
      {
        icon: Github,
        title: 'GitHub Integration',
        description: 'Link videos to GitHub PRs, issues, commits, and files. Connect discussions to your codebase.',
      },
      {
        icon: Webhook,
        title: 'Webhooks & API',
        description: 'Build custom integrations with our comprehensive API and webhook support for any workflow.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Compliance',
    description: 'Enterprise-grade security for your most sensitive content',
    icon: Shield,
    color: 'from-red-500/20 to-red-500/5',
    features: [
      {
        icon: Key,
        title: 'SSO / SAML',
        description: 'Single Sign-On with SAML support. Integrate with your identity provider for secure access.',
      },
      {
        icon: Lock,
        title: 'Two-Factor Authentication',
        description: 'TOTP-based 2FA for all accounts. Protect your team with an extra layer of security.',
      },
      {
        icon: Smartphone,
        title: 'Passkeys / WebAuthn',
        description: 'Support for hardware keys and biometric authentication. The future of passwordless security.',
      },
      {
        icon: Users,
        title: 'Role-Based Access Control',
        description: 'Granular permissions with owner and member roles. Create custom roles for specific needs.',
      },
      {
        icon: FileText,
        title: 'Audit Logs',
        description: 'Complete audit trail of all user actions. Export logs for compliance and security reviews.',
      },
      {
        icon: Shield,
        title: 'GDPR Compliance',
        description: 'Full GDPR compliance with data export, consent tracking, and right to erasure support.',
      },
    ],
  },
  {
    id: 'team-management',
    title: 'Team & Organization',
    description: 'Manage teams, permissions, and organizations at scale',
    icon: Settings,
    color: 'from-yellow-500/20 to-yellow-500/5',
    features: [
      {
        icon: Users,
        title: 'Multi-Tenant Organizations',
        description: 'Support for multiple teams and organizations. Each team gets their own workspace and content.',
      },
      {
        icon: Bell,
        title: 'Member Invitations',
        description: 'Invite team members via email. Track pending and accepted invitations with ease.',
      },
      {
        icon: Settings,
        title: 'Notification Preferences',
        description: 'Customize email and push notifications. Control frequency for activity and digest updates.',
      },
      {
        icon: Palette,
        title: 'Custom Branding',
        description: 'Enterprise custom branding options. Make Nuclom feel like your own platform.',
      },
    ],
  },
  {
    id: 'developer',
    title: 'Developer Tools',
    description: 'Build integrations and automate workflows with our API',
    icon: Code,
    color: 'from-emerald-500/20 to-emerald-500/5',
    features: [
      {
        icon: Key,
        title: 'API Keys',
        description: 'Create API keys for programmatic access. Configure rate limits per key for fair usage.',
      },
      {
        icon: Webhook,
        title: 'Webhooks',
        description: 'Receive real-time notifications for events. Build automated workflows and integrations.',
      },
      {
        icon: Globe,
        title: 'OAuth Applications',
        description:
          'Build OAuth integrations on top of Nuclom. Create third-party apps that integrate with our platform.',
      },
      {
        icon: FileText,
        title: 'API Documentation',
        description: 'Comprehensive API reference with examples. Get started quickly with our developer guides.',
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />

        <div className="w-full max-w-7xl mx-auto relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 mr-2" />
            Platform Features
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Everything You Need for
            <span className="text-primary block mt-2">Video Collaboration</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            From AI-powered transcription to enterprise security, Nuclom provides a complete platform for teams to
            collaborate on video content.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="px-8 py-6 text-lg shadow-lg">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="px-8 py-6 text-lg">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="py-8 px-4 sm:px-6 lg:px-8 border-b bg-muted/30 sticky top-16 z-40">
        <div className="w-full max-w-7xl mx-auto">
          <div className="flex flex-wrap gap-2 justify-center">
            {featureCategories.map((category) => (
              <Link
                key={category.id}
                href={`#${category.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-background border text-sm font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <category.icon className="w-4 h-4" />
                {category.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Sections */}
      {featureCategories.map((category, index) => (
        <section
          key={category.id}
          id={category.id}
          className={`py-20 px-4 sm:px-6 lg:px-8 ${index % 2 === 0 ? '' : 'bg-muted/30'}`}
        >
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <div
                className={`w-20 h-20 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center mx-auto mb-6`}
              >
                <category.icon className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{category.title}</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">{category.description}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {category.features.map((feature) => (
                <Card
                  key={feature.title}
                  className="border-0 shadow-md bg-background/80 backdrop-blur hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <CardHeader className="pb-2">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      ))}

      {/* Feature Count */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-primary/5">
        <div className="w-full max-w-7xl mx-auto text-center">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">50+</div>
              <p className="text-muted-foreground">Platform Features</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">6+</div>
              <p className="text-muted-foreground">Integrations</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">10+</div>
              <p className="text-muted-foreground">AI Capabilities</p>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">99.9%</div>
              <p className="text-muted-foreground">Uptime SLA</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
        <div className="w-full max-w-4xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to experience all these features?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start your 14-day free trial today. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild className="px-8">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="px-8">
              <Link href="/contact">Contact Sales</Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
