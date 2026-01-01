# Phase 4: General Availability (Q4 2025)

### Theme: "Growth & Scale"
Launch publicly with confidence and prepare for rapid growth.

---

## 📊 Current Status (Updated January 2026)

### Milestone 4.1: GA Launch
| Deliverable | Status | Notes |
|-------------|--------|-------|
| Updated marketing website | ⚠️ Partial | Landing page exists |
| Self-serve organization creation | ✅ Done | |
| Complete documentation site | ✅ Done | #94, #95, #96 (closed) |
| Published SLA and support tiers | ✅ Done | `/docs/public/sla.md`, `/docs/public/support-tiers.md` |

### Milestone 4.2: Growth Features
| Deliverable | Status | Notes |
|-------------|--------|-------|
| Referral program with tracking | ✅ Done | Schema, API, rewards system implemented |
| Public video pages with SEO | ⚠️ Partial | Share links exist |
| Embeddable player | ✅ Done | `/embed/[id]` with full customization |
| Partner API documentation | ✅ Done | #95 (closed), embed docs added |

### Milestone 4.3: Platform Maturity
| Deliverable | Status | Notes |
|-------------|--------|-------|
| AI feature expansion | ⚠️ Partial | Transcription, summaries exist |
| Video workflow templates | ✅ Done | 6 system templates, custom templates API |
| Mobile app MVP | ❌ Pending | Not prioritized |
| Enterprise sales package | ✅ Done | `/docs/public/enterprise/` |

---

## Completed in This Sprint

### SLA & Support Documentation
- **Files Created:**
  - `docs/public/sla.md` - Service Level Agreement with uptime guarantees
  - `docs/public/support-tiers.md` - Support tier comparison and escalation procedures
- **Key Content:**
  - 99.5% Pro / 99.9% Enterprise uptime SLA
  - Response time guarantees by priority (P1-P4)
  - Service credit calculations
  - Maintenance windows and communication policy

### Referral Program
- **Database Schema:**
  - `referral_codes` - User shareable codes with usage tracking
  - `referrals` - Individual referral tracking with status
  - `referral_rewards` - Reward tracking and claiming
  - `referral_programs` - Admin-configurable program settings
- **API Endpoints:**
  - `GET/POST /api/referrals` - List and create referral codes
  - `GET /api/referrals/code/[code]` - Validate referral code
  - `GET/POST /api/referrals/rewards` - Manage rewards
- **Service Layer:**
  - `ReferralRepository` Effect-TS service with full CRUD operations

### Embeddable Video Player
- **Pages:**
  - `/embed/[id]` - Minimal, iframe-ready video player
  - Custom layout without navigation/chrome
- **API Endpoints:**
  - `GET /api/embed/[id]` - Fetch embed video data with CORS
  - `POST /api/embed/[id]/view` - Track embed views
- **Features:**
  - URL parameters: autoplay, muted, loop, title, branding, t (start time)
  - Fullscreen support
  - View tracking with source="embed"
  - Cross-origin compatible
- **Documentation:**
  - `docs/public/api/embed.md` - Full embed API and usage guide

### Video Workflow Templates
- **Database Schema:**
  - `workflow_templates` - Template definitions with JSON config
  - `video_workflow_history` - Track template usage per video
- **System Templates (6):**
  1. Meeting Recap - Action items, decisions, chapters
  2. Tutorial - Steps, code detection, multi-language
  3. Product Demo - Feature highlights, auto-sharing
  4. Training - Learning objectives, exercises
  5. Team Onboarding - Setup tasks, resources
  6. Marketing - SEO summaries, hashtags
- **API Endpoints:**
  - `GET/POST /api/workflow-templates` - List and create
  - `GET/PATCH/DELETE/POST /api/workflow-templates/[id]` - Manage templates
- **Documentation:**
  - `docs/public/guides/workflow-templates.md` - User guide

### Enterprise Sales Package
- **Documentation:**
  - `docs/public/enterprise/README.md` - Complete enterprise guide
- **Content:**
  - Feature comparison (Pro vs Enterprise)
  - Security & compliance details
  - Onboarding process (4-week timeline)
  - Pricing with volume discounts
  - Case studies and FAQ

---

## Success Metrics
| Metric | Target | Status |
|--------|--------|--------|
| Registered users | 5,000+ | TBD |
| Uptime SLA | 99.9% | TBD |
| NPS | >50 | TBD |
| MRR | Business goals | TBD |

## Exit Criteria
- [x] Public launch complete (documentation ready)
- [x] Growth features functional (referrals, embeds)
- [x] Enterprise tier selling (sales package ready)
- [ ] Mobile strategy decided

## Remaining Work
1. ~~SLA documentation~~ ✅
2. ~~Referral program~~ ✅
3. ~~Embeddable player~~ ✅
4. ~~Video workflow templates~~ ✅
5. ~~Enterprise sales package~~ ✅
6. Marketing website updates (partial)
7. Public video pages with SEO
8. Mobile app decision

---

## Post-GA Consideration (Future Backlog)
- Live streaming
- Video editing
- AI dubbing (multi-language)
- Advanced transcoding
- White-labeling
- Marketplace
- Self-hosted option

---

*Last Updated: January 2026*
