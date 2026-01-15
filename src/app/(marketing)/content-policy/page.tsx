import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle,
  FileWarning,
  Gavel,
  MessageSquareWarning,
  Play,
  Scale,
  Shield,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { CopyrightYear } from '@/components/copyright-year';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Content Policy',
  description: 'Understand what content is allowed on Nuclom and how we moderate our platform.',
};

const prohibitedContent = [
  {
    icon: Ban,
    title: 'Illegal Content',
    description:
      'Content that violates laws, including but not limited to: child exploitation material, content promoting terrorism, illegal drug manufacturing or sales, and content that facilitates criminal activity.',
  },
  {
    icon: FileWarning,
    title: 'Explicit Adult Content',
    description:
      'Pornographic or sexually explicit material. Nuclom is a professional collaboration platform and is not intended for adult content.',
  },
  {
    icon: MessageSquareWarning,
    title: 'Harassment & Hate Speech',
    description:
      'Content that attacks, demeans, or discriminates against individuals or groups based on race, ethnicity, national origin, religion, gender, sexual orientation, disability, or other protected characteristics.',
  },
  {
    icon: AlertTriangle,
    title: 'Violent or Dangerous Content',
    description:
      'Content that promotes violence, self-harm, or dangerous activities. This includes graphic violence, instructions for harmful activities, and content glorifying violent events.',
  },
  {
    icon: XCircle,
    title: 'Spam & Misleading Content',
    description:
      'Deceptive content, spam, scams, phishing attempts, or content designed to artificially manipulate engagement. This includes misleading thumbnails and titles.',
  },
  {
    icon: Shield,
    title: 'Intellectual Property Violations',
    description:
      'Content that infringes on copyrights, trademarks, or other intellectual property rights of others without proper authorization.',
  },
];

const appealProcess = [
  {
    step: 1,
    title: 'Review the Decision',
    description:
      "When content is removed or your account is actioned, you'll receive an email explaining what policy was violated and what action was taken.",
  },
  {
    step: 2,
    title: 'Submit an Appeal',
    description:
      'If you believe the decision was made in error, you can submit an appeal within 30 days by contacting our support team at appeals@nuclom.com.',
  },
  {
    step: 3,
    title: 'Appeal Review',
    description:
      'Our team will review your appeal and the original decision. We aim to respond to appeals within 5-7 business days.',
  },
  {
    step: 4,
    title: 'Final Decision',
    description:
      "We'll notify you of the outcome. If the appeal is granted, we'll restore your content or lift account restrictions. Appeals decisions are final.",
  },
];

const consequences = [
  {
    level: 'First Violation',
    action: 'Warning',
    description: 'Content removal and a warning notification. Your account remains in good standing.',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  {
    level: 'Repeat Violations',
    action: 'Temporary Restriction',
    description: 'Temporary limitations on your ability to upload or comment. Duration depends on severity.',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
  },
  {
    level: 'Serious Violations',
    action: 'Account Suspension',
    description: 'Temporary or permanent account suspension for severe or repeated violations.',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
  },
  {
    level: 'Illegal Content',
    action: 'Immediate Ban + Reporting',
    description: 'Immediate permanent ban and reporting to appropriate law enforcement authorities.',
    color: 'text-red-800 dark:text-red-300',
    bgColor: 'bg-red-200 dark:bg-red-900/50',
  },
];

export default function ContentPolicyPage() {
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
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Gavel className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Content Policy</h1>
            <p className="text-xl text-muted-foreground">Our guidelines for a safe and productive community.</p>
          </div>

          <div className="space-y-8">
            {/* Introduction */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Our Commitment</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Nuclom is committed to maintaining a safe, professional environment for video collaboration. We
                  believe in fostering creativity and productivity while protecting our community from harmful content.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  This Content Policy outlines what is and isn't allowed on our platform. By using Nuclom, you agree to
                  follow these guidelines. Violations may result in content removal, account restrictions, or
                  termination.
                </p>
              </CardContent>
            </Card>

            {/* Prohibited Content */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <XCircle className="h-6 w-6 text-destructive" />
                  Prohibited Content
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  The following types of content are strictly prohibited on Nuclom:
                </p>
                <div className="grid gap-6">
                  {prohibitedContent.map((item, index) => (
                    <div key={index} className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border">
                      <div className="p-2 rounded-full bg-destructive/10">
                        <item.icon className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* How We Moderate */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  How We Moderate
                </h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">User Reports</h3>
                    <p className="text-muted-foreground text-sm">
                      Our community plays a vital role in keeping Nuclom safe. You can report any content that violates
                      our policies using the "Report" button on videos and comments. All reports are reviewed by our
                      moderation team.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Proactive Detection</h3>
                    <p className="text-muted-foreground text-sm">
                      We use automated systems to detect potentially harmful content. This includes scanning for known
                      prohibited material and identifying patterns that may indicate policy violations.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Human Review</h3>
                    <p className="text-muted-foreground text-sm">
                      Our trained moderation team reviews reported content and automated flags to make final decisions.
                      We consider context and intent when evaluating potential violations.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consequences */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <Scale className="h-6 w-6 text-primary" />
                  Consequences of Violations
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Violations of our Content Policy result in escalating consequences:
                </p>
                <div className="space-y-4">
                  {consequences.map((item, index) => (
                    <div key={index} className={`p-4 rounded-lg ${item.bgColor} border`}>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`font-bold ${item.color}`}>{item.level}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold">{item.action}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Appeal Process */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <CheckCircle className="h-6 w-6 text-primary" />
                  Appeal Process
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  If you believe a moderation decision was made in error, you have the right to appeal:
                </p>
                <div className="space-y-4">
                  {appealProcess.map((item, index) => (
                    <div key={index} className="flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                        {item.step}
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Best Practices */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6">Best Practices</h2>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      Use accurate, descriptive titles and thumbnails for your videos
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Respect the intellectual property rights of others</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Keep comments professional and constructive</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">Report content that violates our policies</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">
                      When in doubt, review this Content Policy before posting
                    </span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Contact */}
            <Card className="shadow-lg">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-4">Questions?</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about this Content Policy or need to report a violation, please contact us at{' '}
                  <Link href="/support" className="text-primary hover:underline">
                    our support page
                  </Link>{' '}
                  or email us at moderation@nuclom.com.
                </p>
              </CardContent>
            </Card>
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
              <Link href="/terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
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
