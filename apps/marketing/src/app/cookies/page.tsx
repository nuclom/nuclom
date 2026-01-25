import { Button } from '@nuclom/ui/button';
import { Card, CardContent } from '@nuclom/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nuclom/ui/table';
import { Link } from '@vercel/microfrontends/next/client';
import { ArrowLeft, Play } from 'lucide-react';
import { Copyright } from '@/components/copyright';

export const metadata = {
  title: 'Cookie Policy',
  description: 'Learn about the cookies used by Nuclom and how to manage them.',
};

const essentialCookies = [
  {
    name: 'better-auth.session_token',
    purpose: 'Authentication session token for keeping you logged in',
    duration: '30 days',
    provider: 'Nuclom',
  },
  {
    name: 'better-auth.csrf_token',
    purpose: 'Cross-site request forgery protection',
    duration: 'Session',
    provider: 'Nuclom',
  },
  {
    name: '__cf_bm',
    purpose: 'Cloudflare bot management - protects against malicious traffic',
    duration: '30 minutes',
    provider: 'Cloudflare',
  },
  {
    name: 'cf_clearance',
    purpose: 'Cloudflare security challenge clearance',
    duration: '30 minutes',
    provider: 'Cloudflare',
  },
];

const localStorageItems = [
  {
    name: 'theme',
    purpose: 'Remembers your dark/light mode preference',
    duration: 'Persistent',
    provider: 'Nuclom',
  },
  {
    name: 'sidebar-state',
    purpose: 'Remembers sidebar expansion state',
    duration: 'Persistent',
    provider: 'Nuclom',
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-linear-to-r from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
              <Play className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-foreground to-foreground/80 bg-clip-text">Nuclom</h1>
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
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Cookie Policy</h1>
            <p className="text-xl text-muted-foreground">Last updated: January 2025</p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="prose prose-gray dark:prose-invert max-w-none p-8">
              <div className="space-y-8">
                {/* Introduction */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">What Are Cookies?</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Cookies are small text files that are placed on your device when you visit a website. They are
                    widely used to make websites work more efficiently and to provide information to the owners of the
                    site. We also use localStorage, a similar technology that stores data in your browser.
                  </p>
                </section>

                {/* How We Use Cookies */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">How We Use Cookies</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We use cookies for the following purposes:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>Essential:</strong> To authenticate you and keep you logged in securely
                    </li>
                    <li>
                      <strong>Security:</strong> To protect against malicious traffic and attacks
                    </li>
                    <li>
                      <strong>Preferences:</strong> To remember your settings and preferences
                    </li>
                  </ul>
                </section>

                {/* Essential Cookies */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">Essential Cookies</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    These cookies are necessary for the website to function properly. They cannot be disabled.
                  </p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Cookie Name</TableHead>
                          <TableHead className="font-semibold">Purpose</TableHead>
                          <TableHead className="font-semibold">Duration</TableHead>
                          <TableHead className="font-semibold">Provider</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {essentialCookies.map((cookie) => (
                          <TableRow key={cookie.name}>
                            <TableCell className="font-mono text-sm">{cookie.name}</TableCell>
                            <TableCell className="text-muted-foreground">{cookie.purpose}</TableCell>
                            <TableCell>{cookie.duration}</TableCell>
                            <TableCell>{cookie.provider}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                {/* Local Storage */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">Local Storage</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We also use browser localStorage to store certain preferences and settings:
                  </p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold">Key</TableHead>
                          <TableHead className="font-semibold">Purpose</TableHead>
                          <TableHead className="font-semibold">Duration</TableHead>
                          <TableHead className="font-semibold">Provider</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {localStorageItems.map((item) => (
                          <TableRow key={item.name}>
                            <TableCell className="font-mono text-sm">{item.name}</TableCell>
                            <TableCell className="text-muted-foreground">{item.purpose}</TableCell>
                            <TableCell>{item.duration}</TableCell>
                            <TableCell>{item.provider}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </section>

                {/* Third-Party Cookies */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">Third-Party Cookies</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Some cookies are placed by third-party services that appear on our pages:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>Cloudflare:</strong> Security and performance cookies that protect our service from
                      attacks and improve load times
                    </li>
                    <li>
                      <strong>Stripe:</strong> When you make a payment, Stripe may set cookies for fraud prevention
                    </li>
                  </ul>
                </section>

                {/* Managing Cookies */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">Managing Your Cookie Preferences</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We only use essential cookies required for the site to function. You can manage cookies through your
                    browser settings. Most browsers allow you to block or delete cookies.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Note: Blocking essential cookies will prevent the site from functioning properly.
                  </p>
                </section>

                {/* Browser-Specific Instructions */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">Browser Cookie Settings</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Here are links to manage cookies in popular browsers:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <a
                        href="https://support.google.com/chrome/answer/95647"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Google Chrome
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Mozilla Firefox
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Safari
                      </a>
                    </li>
                    <li>
                      <a
                        href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Microsoft Edge
                      </a>
                    </li>
                  </ul>
                </section>

                {/* Contact */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">Questions?</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have questions about our use of cookies, please contact us at{' '}
                    <Link href="/support" className="text-primary hover:underline">
                      our support page
                    </Link>{' '}
                    or email us at privacy@nuclom.com.
                  </p>
                </section>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto bg-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-linear-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
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
              <Link href="/support" className="hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
            <Copyright />
          </div>
        </div>
      </footer>
    </div>
  );
}
