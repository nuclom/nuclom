import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";
import { CopyrightYear } from "@/components/copyright-year";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Privacy Policy | Nuclom",
  description: "Learn how Nuclom collects, uses, and protects your personal data.",
};

const PRIVACY_VERSION = "2025-01-01";

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
            <p className="text-xl text-muted-foreground">Last updated: January 2025 | Version: {PRIVACY_VERSION}</p>
          </div>

          <Card className="shadow-lg">
            <CardContent className="prose prose-gray dark:prose-invert max-w-none p-8">
              <div className="space-y-8">
                {/* Introduction */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">Introduction</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Nuclom ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains
                    how we collect, use, disclose, and safeguard your information when you use our video collaboration
                    platform ("Service"). By using the Service, you consent to the data practices described in this
                    policy.
                  </p>
                </section>

                {/* Data Collection */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">1. Information We Collect</h2>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Information You Provide</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>Account Information:</strong> Name, email address, password, and profile picture
                    </li>
                    <li>
                      <strong>Organization Data:</strong> Organization name, team member information
                    </li>
                    <li>
                      <strong>User Content:</strong> Videos, comments, and any other content you upload
                    </li>
                    <li>
                      <strong>Payment Information:</strong> Billing address, payment method details (processed by
                      Stripe)
                    </li>
                    <li>
                      <strong>Communications:</strong> Messages you send to us for support or feedback
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Information Collected Automatically</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>Usage Data:</strong> Pages viewed, features used, timestamps, and interaction patterns
                    </li>
                    <li>
                      <strong>Device Information:</strong> IP address, browser type, operating system, device
                      identifiers
                    </li>
                    <li>
                      <strong>Video Analytics:</strong> Watch time, playback position, video engagement metrics
                    </li>
                    <li>
                      <strong>Cookies and Similar Technologies:</strong> See our{" "}
                      <Link href="/cookies" className="text-primary hover:underline">
                        Cookie Policy
                      </Link>
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Information from Third Parties</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>OAuth Providers:</strong> When you sign in with GitHub or Google, we receive your public
                      profile information
                    </li>
                    <li>
                      <strong>Integration Services:</strong> When you connect Zoom or Google Meet, we access meeting
                      recordings you authorize
                    </li>
                  </ul>
                </section>

                {/* Data Processing */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">2. How We Use Your Information</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We process your data based on the following legal bases under GDPR:
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Contract Performance</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Providing and maintaining the Service</li>
                    <li>Processing video uploads, transcriptions, and AI analysis</li>
                    <li>Managing your account and organization</li>
                    <li>Processing payments and subscriptions</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Legitimate Interests</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Improving and optimizing the Service</li>
                    <li>Preventing fraud and ensuring security</li>
                    <li>Analyzing usage patterns and trends</li>
                    <li>Sending service-related communications</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-3">With Your Consent</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Marketing communications (you can opt out anytime)</li>
                    <li>Analytics cookies (see Cookie Policy)</li>
                    <li>Third-party integrations you authorize</li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Legal Obligations</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Compliance with applicable laws and regulations</li>
                    <li>Responding to legal requests and court orders</li>
                    <li>Protecting our rights and preventing abuse</li>
                  </ul>
                </section>

                {/* Third-Party Sharing */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">3. Information Sharing and Disclosure</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We do not sell your personal information. We may share your data with:
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Service Providers</h3>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>Cloudflare R2:</strong> Video and file storage
                    </li>
                    <li>
                      <strong>Stripe:</strong> Payment processing
                    </li>
                    <li>
                      <strong>AI Providers (OpenAI/Anthropic):</strong> Video transcription and analysis
                    </li>
                    <li>
                      <strong>Resend:</strong> Email delivery
                    </li>
                    <li>
                      <strong>Analytics providers:</strong> Usage analysis (with consent)
                    </li>
                  </ul>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Organization Members</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Content you create may be visible to other members of your organization based on your organization's
                    settings and your role.
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Legal Requirements</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    We may disclose information if required by law, legal process, or government request, or to protect
                    our rights, property, or safety.
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Business Transfers</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    In the event of a merger, acquisition, or sale of assets, your information may be transferred. We
                    will notify you before this occurs.
                  </p>
                </section>

                {/* Data Retention */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">4. Data Retention</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We retain your data for as long as necessary to provide the Service and fulfill the purposes
                    described in this policy:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>
                      <strong>Account Data:</strong> Retained while your account is active, deleted 30 days after
                      account deletion request
                    </li>
                    <li>
                      <strong>Video Content:</strong> Retained while your account is active, moved to trash for 30 days
                      before permanent deletion
                    </li>
                    <li>
                      <strong>Usage Logs:</strong> Retained for up to 12 months for analytics and security purposes
                    </li>
                    <li>
                      <strong>Payment Records:</strong> Retained for 7 years to comply with tax and accounting
                      requirements
                    </li>
                    <li>
                      <strong>Consent Records:</strong> Retained for the duration of your account plus 3 years for
                      compliance
                    </li>
                    <li>
                      <strong>Support Communications:</strong> Retained for 3 years after resolution
                    </li>
                  </ul>
                </section>

                {/* User Rights */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">5. Your Rights (GDPR & CCPA)</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    Depending on your location, you have the following rights regarding your personal data:
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Right to Access</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You can request a copy of all personal data we hold about you. Use the "Download my data" feature in
                    your account settings, or contact us directly.
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Right to Rectification</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You can update your account information at any time through your profile settings. For other
                    corrections, contact us.
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Right to Erasure (Right to be Forgotten)</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You can request deletion of your account and associated data. Use the "Delete my account" feature in
                    settings. Deletion takes effect after a 30-day grace period.
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Right to Data Portability</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You can export your data in a machine-readable format (JSON/ZIP) using our data export feature.
                    Exports include your profile, videos, comments, and settings.
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Right to Object / Withdraw Consent</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    You can opt out of marketing communications and analytics cookies at any time. Essential cookies
                    required for the Service to function cannot be disabled.
                  </p>

                  <h3 className="text-xl font-semibold mt-6 mb-3">Right to Restrict Processing</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    In certain circumstances, you can request that we limit how we process your data. Contact us to make
                    such a request.
                  </p>

                  <p className="text-muted-foreground leading-relaxed mt-6">
                    To exercise any of these rights, go to{" "}
                    <Link href="/settings/profile" className="text-primary hover:underline">
                      Settings &gt; Privacy & Data
                    </Link>{" "}
                    or contact us at privacy@nuclom.com.
                  </p>
                </section>

                {/* Data Security */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">6. Data Security</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    We implement industry-standard security measures to protect your data:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Encryption in transit (TLS 1.3) and at rest</li>
                    <li>Secure password hashing (bcrypt)</li>
                    <li>Regular security audits and penetration testing</li>
                    <li>Access controls and authentication for employees</li>
                    <li>Incident response procedures for data breaches</li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    While we strive to protect your data, no method of transmission or storage is 100% secure. We cannot
                    guarantee absolute security.
                  </p>
                </section>

                {/* International Transfers */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">7. International Data Transfers</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    Your data may be transferred to and processed in countries outside your residence, including the
                    United States. When we transfer data from the EU/EEA, we use appropriate safeguards such as Standard
                    Contractual Clauses approved by the European Commission.
                  </p>
                </section>

                {/* Children's Privacy */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">8. Children's Privacy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    The Service is not intended for individuals under 18 years of age. We do not knowingly collect
                    personal information from children. If you believe a child has provided us with personal data,
                    please contact us immediately.
                  </p>
                </section>

                {/* Policy Updates */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">9. Changes to This Policy</h2>
                  <p className="text-muted-foreground leading-relaxed">
                    We may update this Privacy Policy from time to time. We will notify you of material changes via
                    email or through the Service at least 30 days before they take effect. Your continued use of the
                    Service after the changes become effective constitutes acceptance.
                  </p>
                </section>

                {/* Contact */}
                <section>
                  <h2 className="text-2xl font-bold mb-4">10. Contact Us</h2>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    For privacy-related questions or to exercise your data rights:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                    <li>Email: privacy@nuclom.com</li>
                    <li>
                      Support:{" "}
                      <Link href="/support" className="text-primary hover:underline">
                        nuclom.com/support
                      </Link>
                    </li>
                  </ul>
                  <p className="text-muted-foreground leading-relaxed mt-4">
                    If you are in the EU/EEA and have concerns about how we process your data, you have the right to
                    lodge a complaint with your local Data Protection Authority.
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
              <Link href="/cookies" className="hover:text-foreground transition-colors">
                Cookie Policy
              </Link>
              <Link href="/support" className="hover:text-foreground transition-colors">
                Support
              </Link>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
            © <CopyrightYear /> Nuclom. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
