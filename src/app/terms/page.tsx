import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";

export default function TermsOfServicePage() {
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
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
            <p className="text-xl text-muted-foreground">
              Last updated: January 2025
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="prose prose-gray dark:prose-invert max-w-none p-8">
              <div className="space-y-8">
                <section>
                  <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    By accessing and using Nuclom's services, you accept and agree to be bound by the terms 
                    and provision of this agreement. If you do not agree to abide by the above, please do 
                    not use this service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Nuclom provides a video collaboration platform that enables teams to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Upload, store, and manage video content</li>
                    <li>Collaborate on video projects with team members</li>
                    <li>Share and organize video content</li>
                    <li>Access AI-powered video analysis features</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    To access certain features of our service, you must create an account. You are responsible for:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Maintaining the confidentiality of your account information</li>
                    <li>All activities that occur under your account</li>
                    <li>Notifying us immediately of any unauthorized use</li>
                    <li>Ensuring your account information is accurate and current</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">4. Content Guidelines</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    You retain ownership of content you upload to Nuclom. However, you agree not to upload content that:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Violates any laws or regulations</li>
                    <li>Infringes on intellectual property rights</li>
                    <li>Contains malicious software or code</li>
                    <li>Is offensive, defamatory, or harassing</li>
                    <li>Violates privacy rights of others</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">5. Service Availability</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We strive to maintain high service availability but cannot guarantee uninterrupted access. 
                    We reserve the right to modify, suspend, or discontinue any part of our service with or 
                    without notice.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">6. Limitation of Liability</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Nuclom shall not be liable for any indirect, incidental, special, consequential, or punitive 
                    damages, including without limitation, loss of profits, data, use, goodwill, or other 
                    intangible losses resulting from your use of our service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">7. Termination</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may terminate or suspend your account and access to our service immediately, without 
                    prior notice or liability, for any reason whatsoever, including without limitation if you 
                    breach the Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">8. Changes to Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We reserve the right to modify these terms at any time. We will notify users of any 
                    significant changes via email or through our service. Your continued use of the service 
                    after such modifications constitutes acceptance of the updated terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">9. Contact Information</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have any questions about these Terms of Service, please contact us at{" "}
                    <Link href="/support" className="text-primary hover:underline">
                      our support page
                    </Link>{" "}
                    or email us at legal@nuclom.com.
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
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                <Play className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Nuclom</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/support" className="hover:text-foreground transition-colors">
                Support
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