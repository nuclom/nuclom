import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Input } from '@nuclom/ui/input';
import { Label } from '@nuclom/ui/label';
import { Textarea } from '@nuclom/ui/textarea';
import { Link } from '@vercel/microfrontends/next/client';
import { ArrowLeft, Book, HelpCircle, Mail, MessageCircle, Play } from 'lucide-react';

export default function SupportPage() {
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
          <Button variant="ghost" asChild>
            <Link href="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Support Center</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Get help with Nuclom. We're here to answer your questions and help you succeed.
            </p>
          </div>

          {/* Support Options */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500/20 to-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Book className="w-8 h-8 text-blue-500" />
                </div>
                <CardTitle className="text-lg">Documentation</CardTitle>
                <CardDescription>Comprehensive guides and tutorials</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="#docs">Browse Docs</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-green-500/20 to-green-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-green-500" />
                </div>
                <CardTitle className="text-lg">Live Chat</CardTitle>
                <CardDescription>Chat with our support team</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Start Chat
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500/20 to-purple-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-purple-500" />
                </div>
                <CardTitle className="text-lg">Email Support</CardTitle>
                <CardDescription>Send us a detailed message</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="#contact">Send Email</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="pb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-orange-500/20 to-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <HelpCircle className="w-8 h-8 text-orange-500" />
                </div>
                <CardTitle className="text-lg">FAQ</CardTitle>
                <CardDescription>Find quick answers</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="#faq">View FAQ</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div id="contact">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-2xl">Contact Support</CardTitle>
                  <CardDescription>Send us a message and we'll get back to you as soon as possible.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input id="firstName" placeholder="John" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input id="lastName" placeholder="Doe" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="john@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" placeholder="How can we help?" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" placeholder="Please describe your issue or question in detail..." rows={6} />
                  </div>
                  <Button className="w-full">Send Message</Button>
                </CardContent>
              </Card>
            </div>

            {/* FAQ Section */}
            <div id="faq">
              <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">How do I connect my knowledge sources?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Go to your organization's Sources page and click "Add Source." We support Slack, Notion, GitHub,
                      and video uploads. OAuth makes connecting most sources a one-click process.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">What content types are supported?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      We support Slack messages and threads, Notion pages and databases, GitHub PRs, issues, and
                      discussions, plus video uploads (MP4, MOV, AVI, MKV) and meeting imports from Zoom and Google
                      Meet.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">How do I invite team members?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Go to your organization settings, click on "Members," then click "Invite Member" and enter their
                      email address.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">How does the AI processing work?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      When you connect a source, content is automatically synced and processed. AI generates embeddings
                      for semantic search, extracts decisions, identifies topics, and discovers relationships between
                      content.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">How secure is my content?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      We use enterprise-grade security with encrypted credentials (OAuth tokens are encrypted at rest),
                      secure data centers, and strict access controls to protect your content.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                <Play className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Nuclom</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
            © 2025 Nuclom. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
