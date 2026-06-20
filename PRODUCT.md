# Rental City — Product Reference & Marketing Brief

> A single source of truth for understanding Rental City. Use this to write copy,
> design creatives, build decks, brief agencies, and produce any marketing asset.

---

## 1. The One-Liner

**Rental City is a tenant–landlord matching platform that replaces the broken rental
application process with one verified profile, compatibility-based matching, and
direct landlord connections — no agents, no repeat application fees.**

Primary tagline: **"Apply once. Match fast. Rent smarter."**

Supporting line: *One verified profile. Direct landlord matches. No agents, no repeat
application fees.*

Category descriptor: *The leasing-agent-free rental platform.*

---

## 2. The Problem We Solve

Renting today is fragmented and expensive on both sides:

- **Tenants** pay a new application/screening fee for every property, re-enter the
  same information dozens of times, and get judged on a thin credit pull with no way
  to show they're actually a great tenant.
- **Landlords** sift through unqualified applicants, carry vacancy risk, and rely on
  guesswork (or a leasing agent's commission) to find someone reliable.

Rental City collapses that whole cycle into **one portable application** and a
**data-driven match score** that tells both sides how well they actually fit — before
anyone wastes a showing.

---

## 3. Value Proposition

### For Tenants
- **Universal Rental Application** — one screening (background + credit + financials)
  that stays valid for **6 months** and works across every property you apply to.
- **Rent Score (0–100)** — a portable, objective signal of tenant quality that lets
  you stand out beyond a credit number.
- **Verified financials via Plaid** — prove income and funds without handing over raw
  bank data.
- **Perfect-Fit matches** — see the properties where you're most likely to be
  approved, not an endless undifferentiated list.

### For Landlords
- **Match Score on every applicant** — instantly see compatibility against *your*
  specific risk tolerance, policies, and lifestyle preferences.
- **Lower vacancy risk** — pre-screened, qualified renters with verified income and
  clean checks.
- **No agents, no wasted showings** — list free and get matched directly with renters.
- **Free Rental Value Report** — know what a property should rent for, backed by real
  comparable rentals (powered by RentCast AVM data).

---

## 4. Who Uses Rental City (Audiences)

| Audience | Who they are | What they want |
|---|---|---|
| **Tenants / Renters** | Individuals searching for housing | Stop paying repeat fees, apply once, get approved faster |
| **Landlords / Property owners** | Owners & small managers listing units | Qualified, compatible renters with less risk and no agent fees |
| **Admins** | Platform operators | Manage users, support, moderation, and platform health |

Marketing personas to lead with:
- **"Serial applicant" renter** — tired of $50–$75 fees per application.
- **"DIY landlord"** — self-manages 1–10 units, wants to avoid leasing-agent commissions.

---

## 5. Core Features

### Tenant experience
- Role-based onboarding (choose tenant) and a rich profile (bio, history, city, photo).
- **Rental Needs questionnaire** — location, budget, beds/baths, move-in date, search radius.
- **Compatibility / Tenant questionnaire** — feeds the Rent Score across five dimensions.
- **Home feed of Perfect-Fit matches** based on score thresholds.
- **Universal Application** — pay once to unlock background check, credit report, and
  Plaid-verified financials, shared with any landlord for 6 months.
- **Messaging** — direct threads with landlords, one per property.
- **Application tracking** — Pending / Approved / Rejected / Withdrawn statuses.

### Landlord experience
- Multi-step **Add Property** flow (Basic Info → Amenities → Community → Photos).
- **Lease Preferences** — set risk tolerance, conflict-handling style, and policies
  (evictions, bankruptcies, late-fee limits).
- **Match Score per applicant** with human-readable reasons ("too many late payments
  for this landlord's policy," etc.).
- **Unlock applications** to view full credit/background/financial detail, then
  **Accept or Decline**.
- **Private tenant ratings** (1–5 + comments) on past tenants.
- **Free Rental Value Report** lead magnet.

### Admin experience
- Dashboard with user counts (tenants vs. landlords), open support requests, pending reports.
- User management (merges auth emails with profile roles; suspend users).
- Issue/report moderation and configurable site settings (support email, response times).

---

## 6. The "Secret Sauce": Rent Score & Match Score

Rental City quantifies fit instead of guessing. Two scores, both 0–100.

**Tenant Rent Score** is weighted across five dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| **Affordability** | 35% | Income vs. rent, debt-to-income |
| **Stability** | 25% | Rental/residence history consistency |
| **Payment Risk** | 20–25% | Late payments, defaults |
| **Lifestyle** | 10% | Habits, household fit |
| **Space Fit / Policy Alignment** | 5–10% | Property and policy match |

**Match Compatibility** then compares a tenant against a *specific* landlord's
preferences (risk tolerance, conflict style, hard policies on evictions/bankruptcies).
Hard eligibility checks (evictions, bankruptcies, late-fee limits) run first; a
fairness boost prevents low-risk tenants from being over-penalized by flexible landlords.

> Marketing angle: **"Matching, not just listing."** We score compatibility on both
> sides so good renters and good landlords find each other faster.

---

## 7. Pricing

- **Universal Application fee:** **$125** for a tenant's first application, **$50** for
  each additional — and the screening stays valid for **6 months** across all properties.
- **Landlords list for free.**
- **Rental Value Report is free** (used as a lead magnet).

> Headline math for tenants: instead of paying a fresh fee at every property, pay once
> and apply everywhere for half a year.

---

## 8. Rental Value Report (Lead-Gen Asset)

A free, instant tool that estimates what a property should rent for.

- **Landing headline:** *"Find out what your property could rent for. In minutes."*
- **Subhead:** *"A free, instant rental estimate backed by real comparable rentals
  near you — no agent, no guesswork."*
- **CTA after result:** *"You know what it's worth — now fill it. List your property
  free on Rental City and get matched with pre-screened, qualified renters. No agents.
  No wasted showings."*
- Powered by **RentCast** AVM (rent estimate, range, comparables, market data, property
  value & gross yield). Leads sync to **HubSpot** and can receive a branded report by
  email (**MailerSend**) plus a shareable report URL.
- Lives on the branded **value.gorentalcity.com** subdomain.

---

## 9. Brand Guidelines

**Name:** Rental City  ·  **Location:** Memphis, TN
**Domains:** `gorentalcity.com` (primary), `value.gorentalcity.com` (reports), also `rentalcity.com`

### Colors
| Token | Hex | Use |
|---|---|---|
| Primary Blue | `#3A7AFE` | Primary actions, links |
| Primary Light (Sky) | `#00BBFF` | Accents, gradient start |
| Ink / Navy | `#0F1E3D` | Headlines, dark text |
| Deep Navy | `#0A1733` | Dark backgrounds / hero |
| Success | Emerald/Green | Approved, verified |
| Warning / Locked | Amber / Rose | Pending, locked states |

**Signature gradient:** `linear-gradient(83.7deg, #00BBFF 11.9%, #3A7AFE 90.6%)`

### Typography
- **Inter** (weights 400–900), fallback `-apple-system, sans-serif`.
- Monospace accents (report figures): **JetBrains Mono**.

### Logo & assets
- Wordmarks in gradient, white, and black: `client/public/brand/`
  (`rental-city-wordmark-gradient.svg`, `rental-city-wordmark-white.svg`).
- Blue icon mark: `rc-icon-blue.jpg`.
- Social share image (1171×610): `client/public/rental-report-share.png`
  ("Apply once. Match fast. Rent smarter." graphic).

### Voice & tone
Confident, plain-spoken, anti-friction. We name the pain (repeat fees, agents, wasted
showings) and answer with simplicity. Avoid jargon; lead with the renter/landlord
benefit, not the technology.

---

## 10. Ready-to-Use Messaging

**Taglines**
- Apply once. Match fast. Rent smarter.
- The leasing-agent-free rental platform.
- One application. Six months. Every property.

**Tenant hooks**
- Stop paying to apply. One verified profile works everywhere for 6 months.
- Your credit score isn't your whole story. Show landlords your Rent Score.
- Get matched with the places you're actually likely to get.

**Landlord hooks**
- See how well every applicant fits *your* rules — before the showing.
- List free. Match with pre-screened, qualified renters. Skip the agent.
- Know what it should rent for, then fill it — free Rental Value Report.

**Proof points / differentiators**
- Portable Universal Application (6-month validity)
- Two-sided compatibility scoring (Rent Score + Match Score)
- Plaid-verified income & funds (no raw bank data exposed)
- Integrated background & credit screening
- Free, data-backed Rental Value Reports

---

## 11. How It Works (3-Step Story)

**Tenants:** 1) Build one verified profile & complete the questionnaire → 2) Pay once
to unlock your Universal Application (6 months) → 3) See Perfect-Fit matches, message
landlords, and get approved faster.

**Landlords:** 1) List your property free (or run a free Rental Value Report) → 2) Set
your preferences and policies → 3) Review applicants by Match Score and accept the best fit.

---

## 12. Tech & Trust (for credibility in B2B/press)

- Built on **Supabase** (Postgres, Auth, Storage) with role-based access (tenant/landlord/admin).
- Integrations: **Stripe** (payments), **Plaid** (financial verification),
  **BackgroundChecks.com** (screening), **RentCast** (valuation data),
  **MailerSend** (email), **HubSpot** (CRM), **Google Maps** (location).
- Privacy-conscious: Plaid provides verification *signals* (income verified, funds
  verified) without exposing raw account data to landlords.

---

*Source of truth: the Rental City codebase (client/, server/, supabase/). Pricing,
copy, and brand values above are pulled directly from the product. Update this file as
the product evolves.*
