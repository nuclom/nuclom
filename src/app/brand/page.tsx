import { Check, Download, Play, X } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingFooter } from '@/components/marketing-footer';
import { MarketingHeader } from '@/components/marketing-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Brand Guidelines',
  description:
    'Official Nuclom brand guidelines including logo usage, color palette, typography, and design language documentation.',
};

const brandColors = {
  primary: {
    name: 'Primary Violet',
    lightHex: '#6633ff',
    lightHsl: 'hsl(250, 100%, 60%)',
    darkHex: '#7c66ff',
    darkHsl: 'hsl(250, 100%, 67%)',
    description: 'Main brand color used for primary actions, links, and accents',
  },
  gradientStart: {
    name: 'Gradient Start',
    hex: '#7c3aed',
    hsl: 'hsl(262, 83%, 58%)',
    description: 'Starting color for the brand gradient',
  },
  gradientEnd: {
    name: 'Gradient End',
    hex: '#9333ea',
    hsl: 'hsl(271, 81%, 56%)',
    description: 'Ending color for the brand gradient',
  },
  background: {
    name: 'Background',
    lightHex: '#ffffff',
    lightHsl: 'hsl(0, 0%, 100%)',
    darkHex: '#0d0f17',
    darkHsl: 'hsl(222, 47%, 6%)',
    description: 'Main background color',
  },
  foreground: {
    name: 'Foreground',
    lightHex: '#0f172a',
    lightHsl: 'hsl(222, 47%, 11%)',
    darkHex: '#f8fafc',
    darkHsl: 'hsl(210, 40%, 98%)',
    description: 'Primary text color',
  },
};

const semanticColors = [
  { name: 'Success', hex: '#22c55e', hsl: 'hsl(142, 71%, 45%)', usage: 'Success states, confirmations' },
  { name: 'Warning', hex: '#f59e0b', hsl: 'hsl(38, 92%, 50%)', usage: 'Warnings, caution states' },
  { name: 'Destructive', hex: '#ef4444', hsl: 'hsl(0, 84%, 60%)', usage: 'Errors, destructive actions' },
  { name: 'Muted', hex: '#64748b', hsl: 'hsl(220, 8%, 46%)', usage: 'Secondary text, subtle elements' },
];

function ColorSwatch({
  name,
  hex,
  hsl,
  description,
  className,
}: {
  name: string;
  hex: string;
  hsl: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className="space-y-2">
      <div className={`h-24 rounded-xl shadow-md ${className}`} style={{ backgroundColor: hex }} />
      <div>
        <p className="font-medium">{name}</p>
        <p className="text-sm text-muted-foreground font-mono">{hex}</p>
        <p className="text-xs text-muted-foreground font-mono">{hsl}</p>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
    </div>
  );
}

export default function BrandPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingHeader />

      {/* Hero Section */}
      <section className="relative py-20 lg:py-28 px-4 sm:px-6 lg:px-8 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />

        <div className="w-full max-w-7xl mx-auto relative z-10">
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm font-medium">
            Brand Guidelines
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Nuclom
            <span className="text-primary block mt-2">Brand Identity</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            Official guidelines for using the Nuclom brand, including logo, colors, typography, and design language.
          </p>
        </div>
      </section>

      {/* Logo Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Logo & Icon</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              The Nuclom logo combines a play button icon with the wordmark. Use these assets consistently across all
              platforms.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {/* Primary Logo - Light Background */}
            <Card>
              <CardHeader>
                <CardTitle>Primary Logo</CardTitle>
                <CardDescription>For use on light backgrounds</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-white rounded-xl p-12 flex items-center justify-center border">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#7c3aed] to-[#9333ea] rounded-xl flex items-center justify-center shadow-lg">
                      <Play className="w-7 h-7 text-white fill-white" />
                    </div>
                    <span className="text-3xl font-bold text-gray-900">Nuclom</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Primary Logo - Dark Background */}
            <Card>
              <CardHeader>
                <CardTitle>Primary Logo (Dark)</CardTitle>
                <CardDescription>For use on dark backgrounds</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-[#0d0f17] rounded-xl p-12 flex items-center justify-center">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#7c3aed] to-[#9333ea] rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <Play className="w-7 h-7 text-white fill-white" />
                    </div>
                    <span className="text-3xl font-bold text-white">Nuclom</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Icon Variations */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">App Icon</CardTitle>
                <CardDescription>48x48px minimum for web</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-6 flex items-center justify-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#7c3aed] to-[#9333ea] rounded-xl flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Apple Touch Icon</CardTitle>
                <CardDescription>180x180px for iOS</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-6 flex items-center justify-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#7c3aed] to-[#9333ea] rounded-2xl flex items-center justify-center">
                    <Play className="w-8 h-8 text-white fill-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Social Avatar</CardTitle>
                <CardDescription>Square format for profiles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-6 flex items-center justify-center">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#7c3aed] to-[#9333ea] rounded-full flex items-center justify-center">
                    <Play className="w-7 h-7 text-white fill-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Monochrome</CardTitle>
                <CardDescription>Single color usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted rounded-lg p-6 flex items-center justify-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                  <div className="w-12 h-12 bg-foreground rounded-xl flex items-center justify-center">
                    <Play className="w-6 h-6 text-background fill-background" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Logo Usage Guidelines */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Logo Usage</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Follow these guidelines to ensure consistent brand representation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-green-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="w-5 h-5" />
                  Do
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-1 text-green-500 flex-shrink-0" />
                    Use the official brand gradient (#7c3aed to #9333ea)
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-1 text-green-500 flex-shrink-0" />
                    Maintain clear space around the logo (minimum 1x icon height)
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-1 text-green-500 flex-shrink-0" />
                    Use the play button icon consistently across all touchpoints
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-1 text-green-500 flex-shrink-0" />
                    Use rounded corners (border-radius) on icon containers
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-1 text-green-500 flex-shrink-0" />
                    Ensure sufficient contrast between logo and background
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-red-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <X className="w-5 h-5" />
                  Don't
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 mt-1 text-red-500 flex-shrink-0" />
                    Stretch or distort the logo proportions
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 mt-1 text-red-500 flex-shrink-0" />
                    Change the gradient direction or colors
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 mt-1 text-red-500 flex-shrink-0" />
                    Add effects like shadows, outlines, or glows
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 mt-1 text-red-500 flex-shrink-0" />
                    Place on busy or low-contrast backgrounds
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="w-4 h-4 mt-1 text-red-500 flex-shrink-0" />
                    Recreate or modify the icon shape
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Color Palette */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Color Palette</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our color system is designed for accessibility and consistency across light and dark themes.
            </p>
          </div>

          {/* Brand Gradient */}
          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Brand Gradient</CardTitle>
              <CardDescription>The signature Nuclom gradient used for icons and accents</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="h-32 rounded-xl shadow-lg mb-4"
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 100%)' }}
              />
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">CSS</p>
                  <code className="text-muted-foreground">
                    background: linear-gradient(135deg, #7c3aed 0%, #9333ea 100%);
                  </code>
                </div>
                <div>
                  <p className="font-medium">Tailwind</p>
                  <code className="text-muted-foreground">bg-gradient-to-br from-[#7c3aed] to-[#9333ea]</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Primary Colors */}
          <h3 className="text-xl font-semibold mb-6">Primary Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <ColorSwatch
              name="Primary (Light)"
              hex={brandColors.primary.lightHex}
              hsl={brandColors.primary.lightHsl}
              description="Light mode primary"
            />
            <ColorSwatch
              name="Primary (Dark)"
              hex={brandColors.primary.darkHex}
              hsl={brandColors.primary.darkHsl}
              description="Dark mode primary"
            />
            <ColorSwatch
              name={brandColors.gradientStart.name}
              hex={brandColors.gradientStart.hex}
              hsl={brandColors.gradientStart.hsl}
            />
            <ColorSwatch
              name={brandColors.gradientEnd.name}
              hex={brandColors.gradientEnd.hex}
              hsl={brandColors.gradientEnd.hsl}
            />
          </div>

          {/* Background Colors */}
          <h3 className="text-xl font-semibold mb-6">Background & Foreground</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <ColorSwatch
              name="Background (Light)"
              hex={brandColors.background.lightHex}
              hsl={brandColors.background.lightHsl}
              className="border"
            />
            <ColorSwatch
              name="Background (Dark)"
              hex={brandColors.background.darkHex}
              hsl={brandColors.background.darkHsl}
            />
            <ColorSwatch
              name="Foreground (Light)"
              hex={brandColors.foreground.lightHex}
              hsl={brandColors.foreground.lightHsl}
            />
            <ColorSwatch
              name="Foreground (Dark)"
              hex={brandColors.foreground.darkHex}
              hsl={brandColors.foreground.darkHsl}
              className="border"
            />
          </div>

          {/* Semantic Colors */}
          <h3 className="text-xl font-semibold mb-6">Semantic Colors</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {semanticColors.map((color) => (
              <ColorSwatch
                key={color.name}
                name={color.name}
                hex={color.hex}
                hsl={color.hsl}
                description={color.usage}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Typography</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We use Inter as our primary typeface for its excellent readability and modern aesthetic.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Primary Typeface</CardTitle>
                <CardDescription>Inter - Sans Serif</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-5xl font-bold mb-2">Aa</p>
                  <p className="text-muted-foreground">ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
                  <p className="text-muted-foreground">abcdefghijklmnopqrstuvwxyz</p>
                  <p className="text-muted-foreground">0123456789</p>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Font Stack:</p>
                  <code className="text-sm">
                    "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
                  </code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Type Scale</CardTitle>
                <CardDescription>Heading and body text sizes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl font-bold">H1</span>
                  <span className="text-muted-foreground text-sm">48-72px / Bold</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-4xl font-bold">H2</span>
                  <span className="text-muted-foreground text-sm">36-48px / Bold</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-3xl font-bold">H3</span>
                  <span className="text-muted-foreground text-sm">30px / Semibold</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-2xl font-semibold">H4</span>
                  <span className="text-muted-foreground text-sm">24px / Semibold</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-base">Body</span>
                  <span className="text-muted-foreground text-sm">16px / Regular</span>
                </div>
                <div className="flex items-baseline gap-4">
                  <span className="text-sm">Small</span>
                  <span className="text-muted-foreground text-sm">14px / Regular</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Design Language */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Design Language</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Key design principles and UI patterns that define the Nuclom visual identity.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <Card>
              <CardHeader>
                <CardTitle>Border Radius</CardTitle>
                <CardDescription>Rounded corners for a modern feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-sm" />
                  <div>
                    <p className="font-medium">Small</p>
                    <p className="text-sm text-muted-foreground">4px (0.25rem)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-md" />
                  <div>
                    <p className="font-medium">Medium</p>
                    <p className="text-sm text-muted-foreground">8px (0.5rem)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-xl" />
                  <div>
                    <p className="font-medium">Large</p>
                    <p className="text-sm text-muted-foreground">12px (0.75rem)</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-primary/20 rounded-2xl" />
                  <div>
                    <p className="font-medium">Extra Large</p>
                    <p className="text-sm text-muted-foreground">16px (1rem)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shadows</CardTitle>
                <CardDescription>Elevation and depth</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-background border rounded-lg shadow-sm" />
                  <div>
                    <p className="font-medium">Small</p>
                    <p className="text-sm text-muted-foreground">Subtle elevation</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-background border rounded-lg shadow-md" />
                  <div>
                    <p className="font-medium">Medium</p>
                    <p className="text-sm text-muted-foreground">Cards, dropdowns</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-background border rounded-lg shadow-lg" />
                  <div>
                    <p className="font-medium">Large</p>
                    <p className="text-sm text-muted-foreground">Modals, popovers</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-background border rounded-lg shadow-xl" />
                  <div>
                    <p className="font-medium">Extra Large</p>
                    <p className="text-sm text-muted-foreground">Hero elements</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Spacing</CardTitle>
                <CardDescription>Consistent spacing scale</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-8 bg-primary rounded" />
                  <span className="text-sm">8px (0.5rem) - Tight</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-4 h-8 bg-primary rounded" />
                  <span className="text-sm">16px (1rem) - Base</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-6 h-8 bg-primary rounded" />
                  <span className="text-sm">24px (1.5rem) - Comfortable</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-primary rounded" />
                  <span className="text-sm">32px (2rem) - Relaxed</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-primary rounded" />
                  <span className="text-sm">48px (3rem) - Section</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-8 bg-primary rounded" />
                  <span className="text-sm">64px (4rem) - Large Section</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Component Examples */}
          <h3 className="text-xl font-semibold mb-6">Component Examples</h3>
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Primary actions and interactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button disabled>Disabled</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Voice & Tone */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="w-full max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Voice & Tone</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              How we communicate as a brand - professional yet approachable.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Clear</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We communicate simply and directly. No jargon, no fluff. Every word serves a purpose.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Confident</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We know our product and stand behind it. We're assertive without being arrogant.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Helpful</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We're here to make video collaboration easier. We anticipate needs and provide solutions.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Human</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  We're professional but personable. We use conversational language and avoid being robotic.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Need Brand Assets?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Contact us for access to logo files, brand guidelines PDF, and other marketing materials.
          </p>
          <Button size="lg" asChild>
            <Link href="/contact">
              Contact Us
              <Download className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
