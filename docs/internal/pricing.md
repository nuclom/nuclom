# Nuclom Pricing Strategy

## Overview

This document outlines Nuclom's pricing strategy, cost analysis, and competitive positioning for our video collaboration platform. We offer **3 paid tiers with no free plan**, but include a **15-day free trial** for all plans.

**Important Policy**: If payment is not received within 30 days after trial ends, all organization resources (videos, transcripts, comments, etc.) will be permanently deleted.

---

## Cost Analysis: External Service Providers

### Storage - Cloudflare R2
| Resource | Cost |
|----------|------|
| Storage | $0.015/GB/month |
| Class A Operations (writes) | $4.50/million |
| Class B Operations (reads) | $0.36/million |
| Egress Bandwidth | **FREE** |

*Source: [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)*

### AI Transcription - OpenAI Whisper
| Model | Cost |
|-------|------|
| Whisper API | $0.006/minute |
| GPT-4o Transcribe | $0.006/minute |
| GPT-4o Mini Transcribe | $0.003/minute |

*Source: [OpenAI Pricing](https://platform.openai.com/docs/pricing)*

### AI Analysis - xAI Grok
| Model | Input | Output |
|-------|-------|--------|
| Grok 4.1 Fast | $0.20/million tokens | $0.50/million tokens |
| Grok 3 Mini | $0.30/million tokens | $0.50/million tokens |
| Grok 3 | $3.00/million tokens | $15.00/million tokens |

*Source: [xAI Models and Pricing](https://docs.x.ai/docs/models)*

### Translation - DeepL API
| Plan | Cost |
|------|------|
| API Pro Base | ~$5.49/month |
| Per Character | $25.00/million characters |

*Average transcript (10 min video): ~8,000 characters = $0.20/video/language*

*Source: [DeepL API Plans](https://support.deepl.com/hc/en-us/articles/360021200939-DeepL-API-plans)*

### Email - Resend
| Volume | Cost |
|--------|------|
| Up to 50,000/month | $20/month |
| Up to 100,000/month | $90/month |
| Per 1,000 emails (scale) | $0.65-$0.90 |

*Source: [Resend Pricing](https://resend.com/pricing)*

### Database - PostgreSQL (Supabase/Neon)
| Provider | Plan | Cost |
|----------|------|------|
| Supabase | Pro | $25/month base |
| Neon | Scale | $69/month base |
| Neon | Per GB Storage | $0.35/GB/month |

*Source: [Supabase Pricing](https://supabase.com/pricing)*

### Hosting - Vercel
| Resource | Cost |
|----------|------|
| Pro Plan | $20/user/month |
| Bandwidth (overage) | $0.15/GB |
| Edge Requests | $2/million |

*Source: [Vercel Pricing](https://vercel.com/pricing)*

### Payment Processing - Stripe
| Transaction Type | Fee |
|-----------------|-----|
| Domestic Cards | 2.9% + $0.30 |
| International Cards | 3.1% + $0.30 + 1.5% cross-border |
| ACH Transfers | 0.8% (max $5) |

*Source: [Stripe Pricing](https://stripe.com/pricing)*

---

## Per-Video Cost Breakdown

### Typical Video (10 minutes, 200MB compressed)

| Component | Cost | Notes |
|-----------|------|-------|
| Storage (monthly) | $0.003 | 200MB × $0.015/GB |
| Transcription | $0.06 | 10 min × $0.006/min |
| AI Analysis | $0.002 | ~4K input + ~1.5K output tokens (Grok 4.1 Fast) |
| Translation (per language) | $0.20 | ~8,000 characters |
| Operations | $0.001 | Upload/download requests |
| **Total (no translation)** | **~$0.066** | |
| **Total (5 languages)** | **~$1.07** | |

---

## Competitive Analysis

### Direct Competitors

| Competitor | Plan | Price | Key Features |
|------------|------|-------|--------------|
| **Loom** | Business | $15-18/user/mo | Unlimited videos, custom branding |
| **Loom** | Business + AI | $20-24/user/mo | AI editing, auto-summaries, chapters |
| **Vidyard** | Starter | $59/user/mo | Unlimited hosting, analytics |
| **Vidyard** | Teams | $99/user/mo | CRM integrations, team features |

*Sources: [Loom Pricing](https://www.loom.com/pricing), [Vidyard Pricing](https://www.vidyard.com/pricing/)*

### Our Differentiation
1. **AI-First**: Automatic transcription, summaries, action items, code detection, chapters
2. **Multi-Language**: 28+ languages for subtitles (vs Loom's 50+ but limited editing)
3. **Deep Collaboration**: Time-stamped comments, @mentions, threaded discussions
4. **Integrations**: Zoom & Google Meet recording import
5. **Team Structure**: Organizations, channels, series for content organization

---

## Pricing Tiers

### Margin Requirements
- **Starter Tier**: Minimum 50% margin
- **Business Tier**: Minimum 75% margin
- **Enterprise Tier**: Minimum 75% margin

---

## STARTER PLAN - $19/user/month

**Target**: Small teams (5-15 users) getting started with video collaboration

### Inclusions per User
| Resource | Allocation |
|----------|-----------|
| Storage | 10 GB |
| Video Uploads | 30/month |
| Transcription | 60 minutes/month |
| AI Features | Summaries & Chapters only |
| Subtitle Languages | 3 languages |
| Integrations | Basic (Slack, Email) |
| Support | Community + Email |

### Cost Analysis (per user/month)

| Component | Usage | Cost |
|-----------|-------|------|
| Storage (10GB) | 10GB | $0.15 |
| Storage Operations | ~50K | $0.24 |
| Transcription (60 min) | 60 min | $0.36 |
| AI Analysis (10 videos) | ~40K tokens | $0.03 |
| Translation (5 videos × 3 langs) | 120K chars | $3.00 |
| Email notifications | 15 emails | $0.01 |
| Database share | - | $0.80 |
| Hosting share | - | $1.50 |
| Support overhead | - | $0.50 |
| **Total Cost** | | **$6.59** |

### Margin Calculation
- **Price**: $19.00/user/month
- **Cost**: $6.59/user/month
- **Gross Profit**: $12.41
- **Margin**: **65.3%** ✓ (exceeds 50% target)

### Minimum Commitment
- 5 users minimum = **$95/month**

---

## BUSINESS PLAN - $49/user/month

**Target**: Growing teams (10-50 users) needing full collaboration features

### Inclusions per User
| Resource | Allocation |
|----------|-----------|
| Storage | 25 GB |
| Video Uploads | Unlimited |
| Transcription | 150 minutes/month |
| AI Features | Full suite (summaries, chapters, action items, code detection, tags) |
| Subtitle Languages | 15 languages |
| Integrations | Full (Slack, Zoom, Google Meet, GitHub) |
| Support | Priority Email + Chat |
| Analytics | Team analytics dashboard |
| Branding | Custom player branding |

### Cost Analysis (per user/month)

| Component | Usage | Cost |
|-----------|-------|------|
| Storage (25GB) | 25GB | $0.38 |
| Storage Operations | ~150K | $0.72 |
| Transcription (150 min) | 150 min | $0.90 |
| AI Analysis (25 videos) | ~100K tokens | $0.07 |
| Translation (15 videos × 8 langs) | 960K chars | $4.80 |
| Email notifications | 30 emails | $0.03 |
| Database share | - | $1.50 |
| Hosting share | - | $2.50 |
| Priority support | - | $1.00 |
| Integrations overhead | - | $0.35 |
| **Total Cost** | | **$12.25** |

### Margin Calculation
- **Price**: $49.00/user/month
- **Cost**: $12.25/user/month
- **Gross Profit**: $36.75
- **Margin**: **75.0%** ✓ (meets 75% target)

### Minimum Commitment
- 10 users minimum = **$490/month**

---

## ENTERPRISE PLAN - $89/user/month

**Target**: Large organizations (50+ users) with advanced security and compliance needs

### Inclusions per User
| Resource | Allocation |
|----------|-----------|
| Storage | 50 GB |
| Video Uploads | Unlimited |
| Transcription | Unlimited |
| AI Features | Full suite + Priority processing |
| Subtitle Languages | All 28+ languages |
| Integrations | All + Custom API access |
| Support | Dedicated account manager + 24/7 support |
| Analytics | Advanced analytics + Custom reports |
| Security | SSO/SAML, audit logs, data retention policies |
| SLA | 99.9% uptime guarantee |

### Cost Analysis (per user/month)

| Component | Usage | Cost |
|-----------|-------|------|
| Storage (50GB) | 50GB | $0.75 |
| Storage Operations | ~300K | $1.44 |
| Transcription (200 min avg) | 200 min | $1.20 |
| AI Analysis (40 videos) | ~160K tokens | $0.11 |
| Translation (25 videos × 15 langs) | 3M chars | $7.50 |
| Email notifications | 60 emails | $0.05 |
| Dedicated database | - | $3.00 |
| Dedicated hosting | - | $4.00 |
| Premium support | - | $2.50 |
| SSO/Security overhead | - | $1.00 |
| SLA compliance | - | $0.70 |
| **Total Cost** | | **$22.25** |

### Margin Calculation
- **Price**: $89.00/user/month
- **Cost**: $22.25/user/month
- **Gross Profit**: $66.75
- **Margin**: **75.0%** ✓ (meets 75% target)

### Minimum Commitment
- 25 users minimum = **$2,225/month**
- Volume discounts available for 100+ users (contact sales)

---

## Pricing Summary Table

| Plan | Price | Min Users | Min Monthly | Margin | Target Segment |
|------|-------|-----------|-------------|--------|----------------|
| **Starter** | $19/user/mo | 5 | $95 | 65% | Small teams (5-15) |
| **Business** | $49/user/mo | 10 | $490 | 75% | Growing teams (10-50) |
| **Enterprise** | $89/user/mo | 25 | $2,225 | 75% | Large orgs (50+) |

### Annual Billing Discount
- **20% discount** for annual commitment
- Starter: $15.20/user/mo (billed $912/year for 5 users)
- Business: $39.20/user/mo (billed $4,704/year for 10 users)
- Enterprise: $71.20/user/mo (billed $21,360/year for 25 users)

---

## Trial & Payment Policy

### 15-Day Free Trial
- Full access to selected plan features
- No credit card required to start
- Automatic email reminders at day 10, 13, and 15
- Trial can be extended once (7 days) upon request

### Payment Terms
- Payment due within 30 days of trial end
- Accepted methods: Credit card, ACH transfer, wire transfer (Enterprise only)
- Invoicing available for Enterprise annual contracts

### Data Retention Policy
- **Trial expires without conversion**: Data retained for 14 days, then deleted
- **Subscription cancelled**: Data retained for 30 days, then deleted
- **Payment overdue (30+ days)**: Account suspended, data deleted after 30 more days
- **Total: 60 days from last payment before deletion**

---

## Competitive Positioning

### vs. Loom Business + AI ($24/user/mo)
**Nuclom Starter at $19/user/mo offers:**
- Similar AI features (summaries, chapters)
- Better organization tools (channels, series)
- Time-stamped comments with @mentions
- 3 subtitle languages included
- **$5/user/mo cheaper**

### vs. Loom Business + AI ($24/user/mo)
**Nuclom Business at $49/user/mo offers:**
- More advanced AI (action items, code detection)
- 15 subtitle languages vs limited in Loom
- Zoom & Google Meet import
- Better team analytics
- **~2× price for ~3× the AI capability**

### vs. Vidyard Starter ($59/user/mo)
**Nuclom Business at $49/user/mo offers:**
- Full AI transcription & analysis included
- Multi-language subtitles
- Better collaboration (comments, mentions)
- Similar analytics depth
- **$10/user/mo cheaper with more AI**

### vs. Vidyard Teams ($99/user/mo)
**Nuclom Enterprise at $89/user/mo offers:**
- Full AI suite (Vidyard charges extra)
- 28+ subtitle languages
- Recording import from Zoom/Meet
- Comparable integrations
- **$10/user/mo cheaper**

---

## Revenue Projections

### Year 1 Targets
| Segment | Customers | Avg Users | Avg Revenue | ARR |
|---------|-----------|-----------|-------------|-----|
| Starter | 100 | 8 | $152/mo | $182,400 |
| Business | 50 | 25 | $1,225/mo | $735,000 |
| Enterprise | 10 | 75 | $6,675/mo | $801,000 |
| **Total** | **160** | | | **$1,718,400** |

### Gross Margin Target: 70%+ blended

---

## Implementation Notes

### Metering Requirements
1. Storage usage per organization
2. Video upload count
3. Transcription minutes consumed
4. AI processing calls
5. Translation character count
6. Active users per billing period

### Overage Pricing (Business & Enterprise)
| Resource | Overage Rate |
|----------|--------------|
| Storage | $0.05/GB/month |
| Transcription | $0.01/minute |
| Translation | $0.30/1000 characters |

### Feature Flags by Plan
- `plan.starter`: Basic AI, limited languages
- `plan.business`: Full AI, extended languages, integrations
- `plan.enterprise`: Unlimited, SSO, API access, SLA

---

*Last Updated: December 2024*
*Next Review: Q2 2025*
