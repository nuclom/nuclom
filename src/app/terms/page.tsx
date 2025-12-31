import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Terms of Service | Nuclom",
  description: "Read the Terms of Service for Nuclom video collaboration platform.",
};

const TERMS_VERSION = "2025-01-01";

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
            <p className="text-xl text-muted-foreground">Last updated: January 2025 | Version: {TERMS_VERSION}</p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="prose prose-gray dark:prose-invert max-w-none p-8">
              <div className="space-y-8">
                {/* Beta Disclaimer */}
                <section className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
                  <h2 className="text-2xl font-bold mb-4 text-amber-800 dark:text-amber-200">Beta Service Notice</h2>
                  <p className="text-amber-700 dark:text-amber-300 leading-relaxed mb-4">
                    Nuclom is currently in <strong>beta</strong>. This means:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-amber-700 dark:text-amber-300">
                    <li>The service may experience interruptions, bugs, or unexpected behavior</li>
                    <li>Features may be added, modified, or removed without prior notice</li>
                    <li>Data stored during the beta period may be subject to loss or reset</li>
                    <li>Performance and availability are not guaranteed</li>
                    <li>We strongly recommend maintaining backups of important content</li>
                  </ul>
                  <p className="text-amber-700 dark:text-amber-300 leading-relaxed mt-4">
                    By using the beta service, you acknowledge and accept these limitations.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    By accessing or using Nuclom's services ("Service"), you agree to be bound by these Terms of Service
                    ("Terms"). If you do not agree to these Terms, you may not access or use the Service.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    These Terms constitute a legally binding agreement between you and Nuclom regarding your use of the
                    Service. We may update these Terms from time to time. If we make material changes, we will notify
                    you via email or through the Service. Your continued use after such notification constitutes
                    acceptance of the updated Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">2. Description of Service</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Nuclom is a video collaboration platform that enables teams to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Upload, store, and manage video content</li>
                    <li>Collaborate on video projects with team members</li>
                    <li>Share and organize video content within organizations</li>
                    <li>Access AI-powered video analysis, transcription, and summary features</li>
                    <li>Comment and interact with video content</li>
                    <li>Import recordings from third-party services (Zoom, Google Meet)</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    To access the Service, you must create an account. You are responsible for:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Providing accurate and complete registration information</li>
                    <li>Maintaining the security and confidentiality of your login credentials</li>
                    <li>All activities that occur under your account</li>
                    <li>Notifying us immediately of any unauthorized use of your account</li>
                    <li>Ensuring you are at least 18 years old or have parental consent</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    We reserve the right to suspend or terminate accounts that violate these Terms or for any other
                    reason at our sole discretion.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">4. Acceptable Use Policy</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    You agree to use the Service only for lawful purposes. You must not:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      Upload content that is illegal, harmful, threatening, abusive, harassing, defamatory, vulgar,
                      obscene, or otherwise objectionable
                    </li>
                    <li>Upload content that infringes on intellectual property rights of others</li>
                    <li>Upload malware, viruses, or any malicious code</li>
                    <li>Attempt to gain unauthorized access to other accounts or systems</li>
                    <li>Use the Service to spam, phish, or distribute unsolicited content</li>
                    <li>Interfere with or disrupt the Service or servers</li>
                    <li>Resell, sublicense, or commercially exploit the Service without authorization</li>
                    <li>Violate any applicable laws or regulations</li>
                    <li>Upload content depicting child exploitation or abuse</li>
                    <li>Engage in harassment, bullying, or discrimination against other users</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    For more details, see our{" "}
                    <Link href="/content-policy" className="text-primary hover:underline">
                      Content Policy
                    </Link>
                    .
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">5. Content Ownership and License</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    <strong>Your Content:</strong> You retain full ownership of all content you upload to the Service
                    ("User Content"). By uploading content, you grant Nuclom a worldwide, non-exclusive, royalty-free
                    license to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Store, process, and transmit your content to provide the Service</li>
                    <li>Create transcriptions, summaries, and AI-generated analysis</li>
                    <li>Display your content to authorized users within your organization</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    <strong>Our Content:</strong> The Service, including its design, features, and functionality, is
                    owned by Nuclom and protected by intellectual property laws. You may not copy, modify, or create
                    derivative works without our express permission.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">6. Service Availability and Limitations</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We strive to maintain high availability but cannot guarantee uninterrupted service. We may:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Perform maintenance that temporarily affects service availability</li>
                    <li>Modify, suspend, or discontinue features with or without notice</li>
                    <li>Impose limits on storage, bandwidth, or other resources</li>
                    <li>Restrict access from certain geographic regions</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    During the beta period, service interruptions are more likely and should be expected.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">7. Limitation of Liability</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND</li>
                    <li>
                      WE DISCLAIM ALL IMPLIED WARRANTIES INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
                    </li>
                    <li>WE ARE NOT LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
                    <li>
                      OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS, OR $100,
                      WHICHEVER IS GREATER
                    </li>
                    <li>WE ARE NOT LIABLE FOR LOSS OF DATA, PROFITS, REVENUE, OR BUSINESS OPPORTUNITIES</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    Some jurisdictions do not allow limitation of certain damages, so some of these limitations may not
                    apply to you.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">8. Indemnification</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    You agree to indemnify and hold harmless Nuclom, its officers, directors, employees, and agents from
                    any claims, damages, losses, or expenses (including legal fees) arising from your use of the
                    Service, your User Content, or your violation of these Terms.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">9. Termination</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We may terminate or suspend your account and access to the Service:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>For violation of these Terms</li>
                    <li>For conduct that we determine is harmful to other users or the Service</li>
                    <li>If required by law enforcement or legal process</li>
                    <li>For extended periods of inactivity</li>
                    <li>At our sole discretion, with or without cause</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    You may terminate your account at any time through your account settings. Upon termination, you may
                    request export of your data as described in our{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">10. Governing Law and Disputes</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    These Terms shall be governed by the laws of the State of Delaware, United States, without regard to
                    conflict of law principles.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Any disputes arising from these Terms or your use of the Service shall be resolved through binding
                    arbitration in accordance with the rules of the American Arbitration Association. You waive any
                    right to participate in class action lawsuits.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">11. Changes to Terms</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We reserve the right to modify these Terms at any time. Material changes will be notified via email
                    or through the Service at least 30 days before they take effect. Your continued use of the Service
                    after the changes become effective constitutes acceptance. If you disagree with the changes, you
                    must stop using the Service.
                  </p>
                </section>

                <section>
                  <h2 className="text-2xl font-bold mb-4">12. Contact Information</h2>
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
              <Link href="/content-policy" className="hover:text-foreground transition-colors">
                Content Policy
              </Link>
              <Link href="/support" className="hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} Nuclom. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
