import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
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
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-xl text-muted-foreground">
              Last updated: January 2025
            </p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="prose prose-gray dark:prose-invert max-w-none p-8">
              <div className="space-y-8">
                <section>
                  <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We collect information you provide directly to us, such as when you create an account, 
                    upload videos, or contact us for support. This includes:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Account information (name, email address, password)</li>
                    <li>Video content and metadata</li>
                    <li>Usage data and analytics</li>
                    <li>Communication preferences</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We use the information we collect to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Provide, maintain, and improve our services</li>
                    <li>Process transactions and send related information</li>
                    <li>Send technical notices and support messages</li>
                    <li>Communicate with you about products, services, and events</li>
                    <li>Monitor and analyze trends and usage</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">3. Information Sharing</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We do not sell, trade, or otherwise transfer your personal information to third parties 
                    without your consent, except as described in this policy. We may share your information:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
                    <li>With service providers who assist in our operations</li>
                    <li>To comply with legal obligations</li>
                    <li>To protect our rights and safety</li>
                    <li>In connection with a business transfer</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">4. Data Security</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We implement appropriate technical and organizational measures to protect your personal 
                    information against unauthorized access, alteration, disclosure, or destruction. However, 
                    no internet transmission is completely secure, and we cannot guarantee absolute security.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">5. Your Rights</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    You have the right to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Access and update your personal information</li>
                    <li>Delete your account and associated data</li>
                    <li>Export your data</li>
                    <li>Opt out of marketing communications</li>
                    <li>Request information about data processing</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">6. Contact Us</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    If you have any questions about this Privacy Policy, please contact us at{" "}
                    <Link href="/support" className="text-primary hover:underline">
                      our support page
                    </Link>{" "}
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
              <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 rounded-lg flex items-center justify-center shadow-lg">
                <Play className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Nuclom</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
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