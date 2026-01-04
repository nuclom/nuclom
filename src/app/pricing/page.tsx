"use client";

import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  Crown,
  Globe,
  HardDrive,
  Headphones,
  Palette,
  Shield,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MarketingFooter } from "@/components/marketing-footer";
import { MarketingHeader } from "@/components/marketing-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const pricingPlans = {
  scale: {
    name: "Scale",
    description: "For growing teams that need powerful video collaboration",
    icon: Zap,
    monthlyPrice: 25,
    yearlyPrice: 19,
    yearlyTotal: 228,
    savings: "24%",
    popular: false,
    cta: "Start Free Trial",
    ctaLink: "/register",
    limits: {
      storage: "5 GB/user",
      videos: "25/user/month",
      members: "Up to 25",
      bandwidth: "25 GB/month",
    },
    features: [
      { name: "AI-powered transcription", included: true, highlight: true },
      { name: "Smart summaries & chapters", included: true, highlight: true },
      { name: "Action item extraction", included: true, highlight: true },
      { name: "10 subtitle languages", included: true },
      { name: "Time-stamped comments", included: true },
      { name: "@mentions & notifications", included: true },
      { name: "Zoom & Google Meet import", included: true },
      { name: "Slack integration", included: true },
      { name: "API access & webhooks", included: true },
      { name: "Email support", included: true },
      { name: "Custom branding", included: false },
      { name: "SSO / SAML authentication", included: false },
      { name: "Priority support", included: false },
      { name: "Dedicated account manager", included: false },
    ],
  },
  pro: {
    name: "Pro",
    description: "For organizations that need premium features and higher limits",
    icon: Building2,
    monthlyPrice: 45,
    yearlyPrice: 39,
    yearlyTotal: 468,
    savings: "13%",
    popular: true,
    cta: "Start Free Trial",
    ctaLink: "/register?plan=pro",
    limits: {
      storage: "25 GB/user",
      videos: "100/user/month",
      members: "Unlimited",
      bandwidth: "250 GB/month",
    },
    features: [
      { name: "AI-powered transcription", included: true, highlight: true },
      { name: "Smart summaries & chapters", included: true, highlight: true },
      { name: "Action item extraction", included: true, highlight: true },
      { name: "10 subtitle languages", included: true },
      { name: "Time-stamped comments", included: true },
      { name: "@mentions & notifications", included: true },
      { name: "Zoom & Google Meet import", included: true },
      { name: "Slack integration", included: true },
      { name: "API access & webhooks", included: true },
      { name: "Email support", included: true },
      { name: "Custom branding", included: true, highlight: true },
      { name: "SSO / SAML authentication", included: true, highlight: true },
      { name: "Priority support", included: true, highlight: true },
      { name: "Dedicated account manager", included: true, highlight: true },
    ],
  },
};

const featureComparison = [
  {
    category: "AI & Automation",
    icon: Bot,
    features: [
      { name: "Automatic transcription", scale: "60 min/user/mo", pro: "300 min/user/mo" },
      { name: "AI summaries", scale: true, pro: true },
      { name: "Chapter detection", scale: true, pro: true },
      { name: "Action item extraction", scale: true, pro: true },
      { name: "Code snippet detection", scale: true, pro: true },
      { name: "Semantic search", scale: true, pro: true },
    ],
  },
  {
    category: "Storage & Limits",
    icon: HardDrive,
    features: [
      { name: "Storage per user", scale: "5 GB", pro: "25 GB" },
      { name: "Video uploads", scale: "25/user/mo", pro: "100/user/mo" },
      { name: "Max file size", scale: "500 MB", pro: "2 GB" },
      { name: "Team members", scale: "Up to 25", pro: "Unlimited" },
      { name: "Bandwidth", scale: "25 GB/mo", pro: "250 GB/mo" },
    ],
  },
  {
    category: "Collaboration",
    icon: Users,
    features: [
      { name: "Time-stamped comments", scale: true, pro: true },
      { name: "@mentions & notifications", scale: true, pro: true },
      { name: "Threaded discussions", scale: true, pro: true },
      { name: "Channels & series", scale: true, pro: true },
    ],
  },
  {
    category: "Security & Compliance",
    icon: Shield,
    features: [
      { name: "SSO / SAML", scale: false, pro: true },
      { name: "Advanced permissions", scale: "Basic", pro: "Advanced" },
      { name: "Audit logs", scale: false, pro: true },
      { name: "Data retention controls", scale: false, pro: true },
      { name: "SOC 2 compliance", scale: true, pro: true },
    ],
  },
  {
    category: "Customization & API",
    icon: Palette,
    features: [
      { name: "API access", scale: true, pro: true },
      { name: "Webhooks", scale: true, pro: true },
      { name: "Custom branding", scale: false, pro: true },
      { name: "Custom domain", scale: false, pro: true },
      { name: "White-label options", scale: false, pro: true },
    ],
  },
  {
    category: "Support",
    icon: Headphones,
    features: [
      { name: "Email support", scale: true, pro: true },
      { name: "Priority support", scale: false, pro: true },
      { name: "Dedicated account manager", scale: false, pro: true },
      { name: "Custom onboarding", scale: false, pro: true },
      { name: "SLA guarantee", scale: "99.5%", pro: "99.9%" },
    ],
  },
];

const faqs = [
  {
    question: "What's included in the 14-day free trial?",
    answer:
      "You get full access to all features of your chosen plan during the trial. No credit card required to start. At the end of the trial, you can choose to subscribe or your account will be converted to read-only mode.",
  },
  {
    question: "Can I switch between Scale and Pro?",
    answer:
      "Yes! You can upgrade from Scale to Pro at any time. When you upgrade, you'll be charged a prorated amount for the remainder of your billing period. Downgrades take effect at the end of your current billing period.",
  },
  {
    question: "What happens if I exceed my limits?",
    answer:
      "We'll notify you when you reach 80% of any limit. If you exceed storage, bandwidth, or video upload limits, overage charges will apply automatically. You can also upgrade to Pro for higher limits or delete some content to free up space. We won't delete your content without warning.",
  },
  {
    question: "Do you offer discounts for nonprofits or education?",
    answer:
      "Yes! We offer 50% off for verified nonprofits and educational institutions. Contact our sales team with proof of status to get your discount code.",
  },
  {
    question: "What's your refund policy?",
    answer:
      "Monthly plans include prorated daily refunds if you cancel mid-cycle. Annual plans are non-refundable but you can cancel anytime to prevent renewal. The 24% annual discount reflects this commitment.",
  },
  {
    question: "How does per-user pricing work?",
    answer:
      "You're billed based on the number of active team members in your organization. When you add new members, we prorate the charge. When members leave, your next bill is adjusted accordingly.",
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
            <span className={cn("text-sm font-medium", !isYearly && "text-primary")}>Monthly</span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <span className={cn("text-sm font-medium", isYearly && "text-primary")}>
              Yearly
              <Badge variant="secondary" className="ml-2 text-xs">
                Save up to 24%
              </Badge>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {Object.entries(pricingPlans).map(([key, plan]) => (
              <Card
                key={key}
                className={cn(
                  "relative border-2 transition-all duration-300 hover:-translate-y-1",
                  plan.popular
                    ? "border-primary shadow-xl hover:shadow-2xl"
                    : "hover:shadow-xl hover:border-primary/50",
                )}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="px-4 py-1 bg-primary text-primary-foreground">
                      <Crown className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-4 pt-8">
                  <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <plan.icon className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Price */}
                  <div className="text-center">
                    <div className="text-5xl font-bold mb-1">
                      ${isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                      <span className="text-lg font-normal text-muted-foreground">/user/mo</span>
                    </div>
                    {isYearly && (
                      <p className="text-sm text-muted-foreground">
                        ${plan.yearlyTotal}/user billed annually
                        <Badge variant="outline" className="ml-2 text-xs">
                          Save {plan.savings}
                        </Badge>
                      </p>
                    )}
                    {!isYearly && <p className="text-sm text-muted-foreground">Billed monthly, cancel anytime</p>}
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Storage</div>
                      <div className="font-semibold">{plan.limits.storage}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Videos</div>
                      <div className="font-semibold">{plan.limits.videos}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Team</div>
                      <div className="font-semibold">{plan.limits.members}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-muted-foreground">Bandwidth</div>
                      <div className="font-semibold">{plan.limits.bandwidth}</div>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature.name} className="flex items-center gap-3">
                        {feature.included ? (
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                              feature.highlight ? "bg-primary text-primary-foreground" : "bg-primary/20",
                            )}
                          >
                            <Check className={cn("w-3 h-3", feature.highlight ? "text-white" : "text-primary")} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <X className="w-3 h-3 text-muted-foreground" />
                          </div>
                        )}
                        <span className={cn("text-sm", !feature.included && "text-muted-foreground")}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button className="w-full" size="lg" variant={plan.popular ? "default" : "outline"} asChild>
                    <Link href={plan.ctaLink}>
                      {plan.cta}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Enterprise Contact */}
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              Need a custom solution?{" "}
              <Link href="/contact" className="text-primary hover:underline font-medium">
                Contact our sales team
              </Link>{" "}
              for volume discounts and custom integrations.
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
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 font-medium text-sm">
                      <div>Feature</div>
                      <div className="text-center">Scale</div>
                      <div className="text-center">Pro</div>
                    </div>
                    {/* Feature rows */}
                    {category.features.map((feature) => (
                      <div key={feature.name} className="grid grid-cols-3 gap-4 p-4 items-center">
                        <div className="text-sm">{feature.name}</div>
                        <div className="text-center">
                          {typeof feature.scale === "boolean" ? (
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
                          {typeof feature.pro === "boolean" ? (
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

      {/* Custom Plans Callout */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl mx-auto">
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <Badge variant="outline" className="mb-4">
                    <Building2 className="w-3 h-3 mr-1" />
                    Enterprise
                  </Badge>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4">Need more than Pro?</h3>
                  <p className="text-muted-foreground mb-6">
                    For large organizations with specific requirements, we offer custom plans with volume pricing,
                    dedicated infrastructure, and white-glove onboarding.
                  </p>
                  <ul className="space-y-2 mb-6">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      Volume discounts for 100+ users
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      Dedicated infrastructure options
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      Custom integrations & API development
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary" />
                      On-premise deployment available
                    </li>
                  </ul>
                  <Button asChild>
                    <Link href="/contact">
                      Talk to Sales
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Link>
                  </Button>
                </div>
                <div className="hidden md:flex items-center justify-center">
                  <div className="w-48 h-48 bg-primary/10 rounded-full flex items-center justify-center">
                    <Globe className="w-24 h-24 text-primary/50" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
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
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your video workflow?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Transform your video workflow with Nuclom. Start your 14-day free trial today.
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
