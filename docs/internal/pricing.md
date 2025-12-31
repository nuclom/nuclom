# Nuclom Pricing Strategy

## Overview

Simple, transparent pricing for our video collaboration platform.

- **No free tier**
- **14-day free trial** (no credit card required)
- **Resources deleted** if payment not received within 30 days after trial ends

---

## Pricing

| Billing | Price | Savings |
|---------|-------|---------|
| **Monthly** | $25/user/month | - |
| **Annual** | $19/user/month | 24% off |

Annual billing: $228/user/year (vs $300 monthly)

---

## What's Included (All Users)

### Storage & Uploads
- 20 GB storage per user
- Unlimited video uploads
- Up to 500MB per video
- Supported formats: MP4, MOV, AVI, MKV, WebM, FLV, WMV

### AI Features
- Automatic transcription (120 min/user/month)
- AI-generated summaries
- Chapter/key moment detection
- Action item extraction
- Code snippet detection
- Smart tagging

### Subtitles & Translation
- 10 subtitle languages included
- WebVTT and SRT export

### Collaboration
- Time-stamped comments
- @mentions and notifications
- Threaded discussions
- Channels and series organization

### Integrations
- Zoom recording import
- Google Meet recording import
- Slack notifications

### Support
- Email support
- Help documentation

---

## Cost Analysis

### External Service Costs

| Service | Provider | Cost |
|---------|----------|------|
| Storage | Cloudflare R2 | $0.015/GB/month |
| Transcription | OpenAI Whisper | $0.006/minute |
| AI Analysis | xAI Grok 4.1 Fast | $0.20/$0.50 per M tokens |
| Translation | DeepL | $25/million characters |
| Email | Resend | $0.90/1000 emails |
| Hosting | Vercel | $20/user/month base |
| Database | Supabase/Neon | $25-69/month base |
| Payments | Stripe | 2.9% + $0.30 |

### Per-User Cost Breakdown (Monthly)

| Component | Usage | Cost |
|-----------|-------|------|
| Storage (20GB) | 20GB | $0.30 |
| Storage Operations | ~100K | $0.48 |
| Transcription (120 min) | 120 min | $0.72 |
| AI Analysis (20 videos) | ~80K tokens | $0.05 |
| Translation (10 videos × 5 langs) | 400K chars | $10.00 |
| Email notifications | 25 emails | $0.02 |
| Database share | - | $1.20 |
| Hosting share | - | $2.00 |
| Support overhead | - | $0.75 |
| **Total Cost** | | **$15.52** |

### Margin Analysis

| Billing | Price | Cost | Margin |
|---------|-------|------|--------|
| Monthly ($25) | $25.00 | $15.52 | **37.9%** |
| Annual ($19) | $19.00 | $15.52 | **18.3%** |

**Blended margin** (assuming 60% annual / 40% monthly): **26.7%**

*Note: Margins are lower than typical SaaS but competitive pricing prioritizes market share.*

---

## Competitive Positioning

| Competitor | Price | vs. Nuclom |
|------------|-------|------------|
| Loom Business | $15-18/user/mo | We include full AI suite |
| Loom Business + AI | $20-24/user/mo | Similar price, more languages |
| Vidyard Starter | $59/user/mo | 58% cheaper |
| Vidyard Teams | $99/user/mo | 75% cheaper |

### Why Nuclom at $25/mo wins:
- Full AI features (transcription, summaries, action items, code detection)
- 10 subtitle languages included
- Zoom & Google Meet import
- Time-stamped collaboration
- Simple, predictable pricing

---

## Trial & Payment Policy

### 14-Day Free Trial
- Full access to all features
- No credit card required
- Email reminders at day 7, 12, and 14

### Payment Terms
- Payment due within 30 days of trial end
- Accepted: Credit card, ACH transfer

### Refund Policy

| Plan | Refund Policy | Details |
|------|---------------|---------|
| **Monthly** | Prorated daily refund | Refund = remaining days × daily rate |
| **Yearly** | Non-refundable | No refunds after subscription starts |

**Monthly Refund Calculation:**
- Daily rate = $25 ÷ 30 = $0.833/day
- Refund amount = Days remaining × $0.833
- Example: Cancel after 10 days = 20 days × $0.833 = $16.67 refund

**Yearly Plan:**
- 24% discount reflects commitment to full year
- No partial refunds available
- Can cancel at end of billing period (no renewal)

### Data Retention
| Scenario | Data Kept | Then Deleted |
|----------|-----------|--------------|
| Trial expires (no payment) | 14 days | Permanently |
| Subscription cancelled | 30 days | Permanently |
| Payment overdue | 30 days (suspended) | After 30 more days |

---

## Revenue Projections

### Year 1 Targets (Blended $21/user avg)

| Customers | Avg Users | Monthly Revenue | ARR |
|-----------|-----------|-----------------|-----|
| 200 | 15 | $63,000 | $756,000 |

### Break-even Analysis
- Fixed costs (infra base): ~$500/month
- Variable cost per user: ~$15.52
- Break-even at ~53 users (monthly) or ~83 users (annual)

---

## Implementation

### Feature Flags
- `subscription.active`: Full access
- `subscription.trial`: 14-day trial period
- `subscription.expired`: Read-only, then deletion

### Metering
1. Storage usage per organization
2. Transcription minutes consumed
3. Active users per billing period

### Overage Handling
No hard limits - usage is monitored and users contacted if significantly exceeding fair use (>2x allocation).

### Stripe IaC Setup

Run the setup script to create Stripe products and prices:

```bash
# Preview changes (dry run)
STRIPE_SECRET_KEY=sk_... npx tsx scripts/setup-stripe.ts --dry-run

# Create resources in Stripe
STRIPE_SECRET_KEY=sk_... npx tsx scripts/setup-stripe.ts

# Force update existing resources
STRIPE_SECRET_KEY=sk_... npx tsx scripts/setup-stripe.ts --force
```

**Stripe Products/Prices Created:**

| Product | Price ID Nickname | Amount | Interval | Refund Policy |
|---------|-------------------|--------|----------|---------------|
| Nuclom Pro | Pro Monthly | $25.00 | month | Prorated daily |
| Nuclom Pro | Pro Yearly | $228.00 | year | Non-refundable |

---

*Last Updated: December 2025*
