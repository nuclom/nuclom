'use client';

import { Link } from '@vercel/microfrontends/next/client';
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  Globe,
  HardDrive,
  Headphones,
  Palette,
  Rocket,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const pricingPlans = {
  scale: {
    name: 'Scale',
    description: 'For small teams getting started with unified knowledge management',
    icon: Zap,
    monthlyPrice: 34,
    yearlyPrice: 29,
    yearlyTotal: 348,
    savings: '15%',
    popular: false,
    cta: 'Start Free Trial',
    ctaLink: '/register?plan=scale',
    limits: {
      storage: '5 GB/user',
      sources: '3 sources',
      members: 'Up to 10',
      bandwidth: '25 GB/month',
    },
    features: [
      { name: 'Slack, Notion & GitHub sync', included: true, highlight: true },
      { name: 'AI transcription (90 min/mo)', included: true, highlight: true },
      { name: 'AI summaries & decision tracking', included: true, highlight: true },
      { name: 'Knowledge graph', included: true },
      { name: 'Unified semantic search', included: true },
      { name: 'Topic clustering', included: true },
      { name: 'Expertise mapping', included: true },
      { name: 'Zoom & Meet auto-import', included: true },
      { name: 'API & webhooks', included: true },
      { name: 'Email support', included: true },
      { name: 'Custom branding', included: false },
      { name: 'Priority support', included: false },
      { name: 'SSO / SAML', included: false },
      { name: 'Audit logs', included: false },
    ],
  },
  growth: {
    name: 'Growth',
    description: 'For growing teams that need more capacity and premium features',
    icon: TrendingUp,
    monthlyPrice: 58,
    yearlyPrice: 49,
    yearlyTotal: 588,
    savings: '15%',
    popular: true,
    cta: 'Start Free Trial',
    ctaLink: '/register?plan=growth',
    limits: {
      storage: '15 GB/user',
      sources: '6 sources',
      members: 'Up to 30',
      bandwidth: '100 GB/month',
    },
    features: [
      { name: 'Everything in Scale, plus:', included: true, highlight: true },
      { name: 'AI transcription (300 min/mo)', included: true, highlight: true },
      { name: 'Custom branding', included: true, highlight: true },
      { name: 'Priority support (24hr SLA)', included: true, highlight: true },
      { name: 'Advanced analytics', included: true },
      { name: 'Password-protected links', included: true },
      { name: 'Expiring share links', included: true },
      { name: '25,000 content items', included: true },
      { name: '2,000 AI requests/mo', included: true },
      { name: 'Usage overage billing', included: true },
      { name: 'SSO / SAML', included: false },
      { name: 'Audit logs', included: false },
      { name: 'Dedicated account manager', included: false },
      { name: 'Data retention controls', included: false },
    ],
  },
  pro: {
    name: 'Pro',
    description: 'For organizations requiring unlimited scale, SSO, and compliance',
    icon: Building2,
    monthlyPrice: 93,
    yearlyPrice: 79,
    yearlyTotal: 948,
    savings: '15%',
    popular: false,
    cta: 'Start Free Trial',
    ctaLink: '/register?plan=pro',
    limits: {
      storage: '50 GB/user',
      sources: 'Unlimited',
      members: 'Unlimited',
      bandwidth: '500 GB/month',
    },
    features: [
      { name: 'Everything in Growth, plus:', included: true, highlight: true },
      { name: 'AI transcription (1,000 min/mo)', included: true, highlight: true },
      { name: 'SSO / SAML authentication', included: true, highlight: true },
      { name: 'Audit logs', included: true, highlight: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'Data retention controls', included: true },
      { name: 'Advanced permissions', included: true },
      { name: 'Custom domain', included: true },
      { name: 'Unlimited content items', included: true },
      { name: '10,000 AI requests/mo', included: true },
      { name: '99.9% uptime SLA', included: true },
      { name: '4-hour support response', included: true },
      { name: 'Quarterly business reviews', included: true },
      { name: 'Custom onboarding', included: true },
    ],
  },
};

const featureComparison = [
  {
    category: 'Knowledge Sources',
    icon: Globe,
    features: [
      { name: 'Slack workspace sync', scale: true, growth: true, pro: true },
      { name: 'Notion workspace sync', scale: true, growth: true, pro: true },
      { name: 'GitHub repository sync', scale: true, growth: true, pro: true },
      { name: 'Meetings (Zoom, Meet auto-import)', scale: true, growth: true, pro: true },
      { name: 'Number of sources', scale: '3', growth: '6', pro: 'Unlimited' },
      { name: 'Content items', scale: '5,000', growth: '25,000', pro: 'Unlimited' },
    ],
  },
  {
    category: 'AI & Processing',
    icon: Bot,
    features: [
      { name: 'AI transcription', scale: '90 min/mo', growth: '300 min/mo', pro: '1,000 min/mo' },
      { name: 'AI requests', scale: '500/mo', growth: '2,000/mo', pro: '10,000/mo' },
      { name: 'AI summaries', scale: true, growth: true, pro: true },
      { name: 'Decision extraction', scale: true, growth: true, pro: true },
      { name: 'Topic clustering', scale: true, growth: true, pro: true },
      { name: 'Expertise detection', scale: true, growth: true, pro: true },
      { name: 'Semantic search', scale: true, growth: true, pro: true },
    ],
  },
  {
    category: 'Knowledge Graph',
    icon: Sparkles,
    features: [
      { name: 'Knowledge graph', scale: true, growth: true, pro: true },
      { name: 'Decision tracking', scale: true, growth: true, pro: true },
      { name: 'Relationship discovery', scale: true, growth: true, pro: true },
      { name: 'Cross-source linking', scale: true, growth: true, pro: true },
      { name: 'Advanced analytics', scale: false, growth: true, pro: true },
    ],
  },
  {
    category: 'Storage & Limits',
    icon: HardDrive,
    features: [
      { name: 'Storage per user', scale: '5 GB', growth: '15 GB', pro: '50 GB' },
      { name: 'Video uploads/month', scale: '50', growth: '200', pro: 'Unlimited' },
      { name: 'Max file size', scale: '500 MB', growth: '2 GB', pro: '5 GB' },
      { name: 'Team members', scale: 'Up to 10', growth: 'Up to 30', pro: 'Unlimited' },
      { name: 'Bandwidth', scale: '25 GB/mo', growth: '100 GB/mo', pro: '500 GB/mo' },
      { name: 'Usage overages', scale: 'Hard limit', growth: 'Pay-as-you-go', pro: 'Pay-as-you-go' },
    ],
  },
  {
    category: 'Collaboration',
    icon: Users,
    features: [
      { name: '@mentions & notifications', scale: true, growth: true, pro: true },
      { name: 'Activity feed', scale: true, growth: true, pro: true },
      { name: 'Time-stamped comments', scale: true, growth: true, pro: true },
      { name: 'Password-protected links', scale: false, growth: true, pro: true },
      { name: 'Expiring share links', scale: false, growth: true, pro: true },
    ],
  },
  {
    category: 'Security & Compliance',
    icon: Shield,
    features: [
      { name: 'SSO / SAML', scale: false, growth: false, pro: true },
      { name: 'Audit logs', scale: false, growth: false, pro: true },
      { name: 'Data retention controls', scale: false, growth: false, pro: true },
      { name: 'Advanced permissions', scale: 'Basic', growth: 'Basic', pro: 'Advanced' },
      { name: 'SOC 2 compliance', scale: true, growth: true, pro: true },
      { name: '2FA / Passkeys', scale: true, growth: true, pro: true },
    ],
  },
  {
    category: 'Customization & API',
    icon: Palette,
    features: [
      { name: 'API access', scale: true, growth: true, pro: true },
      { name: 'Webhooks', scale: true, growth: true, pro: true },
      { name: 'Custom branding', scale: false, growth: true, pro: true },
      { name: 'Custom domain', scale: false, growth: false, pro: true },
      { name: 'Zapier integration', scale: true, growth: true, pro: true },
    ],
  },
  {
    category: 'Support',
    icon: Headphones,
    features: [
      { name: 'Email support', scale: true, growth: true, pro: true },
      { name: 'Response SLA', scale: '48 hours', growth: '24 hours', pro: '4 hours' },
      { name: 'Priority support', scale: false, growth: true, pro: true },
      { name: 'Dedicated account manager', scale: false, growth: false, pro: true },
      { name: 'Custom onboarding', scale: false, growth: false, pro: true },
      { name: 'Uptime SLA', scale: '99.5%', growth: '99.5%', pro: '99.9%' },
    ],
  },
];

const faqs = [
  {
    question: "What's included in the 14-day free trial?",
    answer:
      'You get full access to all features of your chosen plan during the trial. No credit card required to start. At the end of the trial, you can choose to subscribe or your account will be converted to read-only mode.',
  },
  {
    question: 'Can I switch between plans?',
    answer:
      "Yes! You can upgrade at any time and you'll be charged a prorated amount for the remainder of your billing period. Downgrades take effect at the end of your current billing period.",
  },
  {
    question: 'What happens if I exceed my limits?',
    answer:
      "On Scale, limits are hard caps - you'll need to upgrade to continue. On Growth and Pro, we offer pay-as-you-go overages so you're never blocked. We notify you at 80% of any limit.",
  },
  {
    question: 'Do you offer discounts for nonprofits or education?',
    answer:
      'Yes! We offer 50% off for verified nonprofits and educational institutions. Contact our sales team with proof of status to get your discount code.',
  },
  {
    question: "What's your refund policy?",
    answer:
      'Monthly plans include prorated daily refunds if you cancel mid-cycle. Annual plans are non-refundable but you can cancel anytime to prevent renewal. The 15% annual discount reflects this commitment.',
  },
  {
    question: 'How does per-user pricing work?',
    answer:
      "You're billed based on the number of active team members in your organization. When you add new members, we prorate the charge. When members leave, your next bill is adjusted accordingly.",
  },
  {
    question: 'Do you offer custom enterprise solutions?',
    answer:
      'Yes! For organizations that need BYOC (Bring Your Own Cloud), data residency controls, or custom integrations, contact our sales team for a tailored solution.',
  },
];

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(true);

  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

        <div className="w-full max-w-7xl mx-auto relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
            <Sparkles className="w-4 h-4 mr-2" />
            Simple, Transparent Pricing
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Choose the plan that's
            <span className="text-primary block mt-2">right for your team</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            Start with a 14-day free trial. No credit card required. Cancel anytime.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={cn('text-sm font-medium', !isYearly && 'text-primary')}>Monthly</span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={cn('text-sm font-medium', isYearly && 'text-primary')}>
              Yearly
              <Badge variant="secondary" className="ml-2 text-xs">
                Save 15%
              </Badge>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(pricingPlans).map(([key, plan]) => (
              <Card
                key={key}
                className={cn(
                  'relative border-2 transition-all duration-300 hover:-translate-y-1',
                  plan.popular
                    ? 'border-primary shadow-xl hover:shadow-2xl'
                    : 'hover:shadow-xl hover:border-primary/50',
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="px-4 py-1 bg-primary text-primary-foreground">
                      <Rocket className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4 pt-8">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <plan.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-sm">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-5">
                  {/* Price */}
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-1">
                      ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                      <span className="text-base font-normal text-muted-foreground">/user/mo</span>
                    </div>
                    {isYearly && (
                      <div className="text-sm text-muted-foreground">${plan.yearlyTotal}/user billed annually</div>
                    )}
                    {!isYearly && <p className="text-sm text-muted-foreground">Billed monthly</p>}
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Storage</div>
                      <div className="font-medium">{plan.limits.storage}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Sources</div>
                      <div className="font-medium">{plan.limits.sources}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Team</div>
                      <div className="font-medium">{plan.limits.members}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Bandwidth</div>
                      <div className="font-medium">{plan.limits.bandwidth}</div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature.name} className="flex items-center gap-2">
                        {feature.included ? (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 bg-primary text-primary-foreground">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <X className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                        )}
                        <span
                          className={cn(
                            'text-sm',
                            !feature.included && 'text-muted-foreground',
                            feature.highlight && feature.included && 'font-medium',
                          )}
                        >
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button className="w-full" size="lg" variant={plan.popular ? 'default' : 'outline'} asChild>
                    <Link href={plan.ctaLink}>
                      {plan.cta}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Enterprise mention */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              Need BYOC, data residency, or custom integrations?{' '}
              <Link href="/contact" className="text-primary hover:underline font-medium">
                Contact sales
              </Link>{' '}
              for enterprise solutions.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="w-full max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              Compare Plans
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Detailed Feature Comparison</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See exactly what's included in each plan to make the right choice for your team
            </p>
          </div>

          <div className="space-y-8">
            {featureComparison.map((category) => (
              <Card key={category.category} className="overflow-hidden">
                <CardHeader className="bg-muted/50 py-4">
                  <div className="flex items-center gap-3">
                    <category.icon className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">{category.category}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {/* Header row */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-muted/30 font-medium text-sm">
                      <div>Feature</div>
                      <div className="text-center">Scale</div>
                      <div className="text-center">Growth</div>
                      <div className="text-center">Pro</div>
                    </div>
                    {/* Feature rows */}
                    {category.features.map((feature) => (
                      <div key={feature.name} className="grid grid-cols-4 gap-4 p-4 items-center">
                        <div className="text-sm">{feature.name}</div>
                        <div className="text-center">
                          {typeof feature.scale === 'boolean' ? (
                            feature.scale ? (
                              <Check className="w-5 h-5 text-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-sm font-medium">{feature.scale}</span>
                          )}
                        </div>
                        <div className="text-center">
                          {typeof feature.growth === 'boolean' ? (
                            feature.growth ? (
                              <Check className="w-5 h-5 text-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-sm font-medium text-primary">{feature.growth}</span>
                          )}
                        </div>
                        <div className="text-center">
                          {typeof feature.pro === 'boolean' ? (
                            feature.pro ? (
                              <Check className="w-5 h-5 text-primary mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-muted-foreground mx-auto" />
                            )
                          ) : (
                            <span className="text-sm font-medium text-primary">{feature.pro}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 px-4 py-2">
              FAQs
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-6">
            {faqs.map((faq) => (
              <Card key={faq.question}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-semibold">{faq.question}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10" />
        <div className="w-full max-w-4xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to unify your organization's knowledge?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Connect your first knowledge source in minutes. Start your 14-day free trial today.
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
