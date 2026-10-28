# Plan — Aged-Domains / PBN vetting app: feasibility, analogs, pitfalls

## Changelog
- 2026-08-27: Initial plan.

## Origin & reframe

Trigger: founder forwarded a Telegram job ad (posted 2026-08-27 by "Александр", contact @Hr_Migrator) recruiting a remote, piece-rate **Aged Domains / PBN Specialist**. The role as specified: source aged/expired .com domains from auctions and direct owners; vet each via WHOIS, Wayback Machine, Ahrefs, Majestic; assess backlink profile, topic, GEO, and history; screen out spam/casino/adult/pharma/hacked-history red flags; deliver a shortlist of 10–15 vetted domains per month.

Founder's actual question (translated from voice-dictated Russian): what is the probability of building **an application that does this job** — analogs that already exist, and the pitfalls of trying.

**Reframed question**: Is there a viable software product in automating or semi-automating aged-domain sourcing + vetting for the PBN/link-building buyer segment — given (a) tools already on the market, (b) the cost/access reality of the data this job depends on (Ahrefs, Majestic, historical WHOIS, Wayback), and (c) that the entire use case sits inside a category (PBNs) that the dominant platform (Google) treats as a policy violation it actively hunts for?

This is a **validation** question (build/no-build), not a request to spec the product yet.

## Falsifiable hypotheses

- **H1 (demand gap)**: A real, monetizable gap exists between what current self-serve tools output and what buyers trust, evidenced by buyers still paying humans piece-rate to manually re-vet domains rather than trusting tool output alone.
- **H2 (data/cost feasibility)**: A solo/indie builder cannot replicate the data layer this job relies on (backlink index at Ahrefs/Majestic quality + historical WHOIS + full Wayback history) at a cost structure that supports an indie-scale product — because the trusted metrics (DR, TF/CF) are proprietary crawled indices, not something cheaply re-derivable.
- **H3 (policy/market durability risk)**: The addressable market is structurally adversarial to Google's policies (PBNs are an explicit "link scheme" violation) and has been the target of repeated deindexing/devaluation actions — meaning a tool purpose-built for PBN construction carries platform-risk exposure beyond an ordinary SaaS, and the buyer base may be shrinking as Google's detection improves.
- **H4 (automation ceiling)**: The specific judgment calls in the job post (hacked-history detection, topical/GEO coherence, "spam neighborhood" pattern recognition) exceed what rule-based/automated scoring reliably does today — so the realistic product is a human-in-the-loop triage tool (narrows thousands of candidates to dozens for a human), not a full replacement for the specialist role.

## Genre & blocks

Custom: **validation** (build/no-build + risk register) blended with **landscape** (competitor/analog mapping). Blocks: competitive landscape, technical/data feasibility, legal & platform-policy risk, automation ceiling, demand & willingness-to-pay signals, business-model options, risk register, go/no-go recommendation with scoped MVP alternatives.

## Sourcing strategy — parallel workstreams

| # | Workstream | Scope | Source file range |
|---|-----------|-------|--------------------|
| A | Competitive landscape / analogs | Existing expired/aged-domain tools (SpamZilla, ExpiredDomains.net, DomCop, Domain Hunter Gatherer, etc.), what they already automate vs. leave manual, pricing tiers, Upwork/Fiverr gig supply for this exact task as a demand proxy | sources/01–08 |
| B | Technical & data-cost feasibility | Ahrefs API/data-access pricing, Majestic API pricing, historical/bulk WHOIS API pricing, Wayback Machine API cost & limits, cheaper/open alternatives (Common Crawl, Moz, OpenPageRank) | sources/09–16 |
| C | Legal & platform-policy risk | Google Search Central link-schemes/link-spam policy pages, Google's link-spam algorithm update announcements, documented/reported PBN deindexing case studies, general legality of the expired-domain trade itself vs. the PBN-use-case's ToS exposure | sources/17–24 |
| D | Demand signals & adversarial | Forum/community sentiment on tool-vs-manual gap (BlackHatWorld, Reddit r/SEO /r/blackhatseo), pricing/willingness-to-pay signals for adjacent SaaS, and explicit opposition search: "is PBN dead," Google's improving PBN-network detection, link-building buyers shifting budget to non-PBN tactics | sources/25–32 |

## Opposition / adversarial queries (Phase 6)

- If existing tools (SpamZilla etc.) already claim to automate spam/red-flag detection, is H1's "gap" actually real or is the job posting just a buyer who hasn't adopted existing tooling?
- Is the PBN/expired-domain niche actually shrinking (Google detection improving, budgets shifting to digital PR/HARO-style links) such that H3 makes the whole category a bad bet regardless of tooling quality?
- Could the "aged domain" data need (WHOIS + Wayback + backlinks) be served adequately by *reselling* Ahrefs/Majestic/WhoisXML API access at markup rather than building a competing index — undercutting H2's pessimism?
- Is there a legitimate, non-PBN framing of the same tool (e.g., "brand-safety domain due diligence," redirect/301 audits, expired-domain content-marketing reuse) that sidesteps H3 entirely?

## Risk register

- No live Ahrefs/Majestic/Similarweb plugin access this session (auth required, unavailable) — pricing/access claims sourced from public pricing pages and third-party commentary, not a live account; flagged where relevant.
- PBN/expired-domain forums (BlackHatWorld etc.) skew toward practitioners with an incentive to talk up the tactic's viability — triangulate forum sentiment against Google's own policy language and independent SEO-industry commentary, not forum claims alone.
- "Probability of success" for a not-yet-defined product is inherently a judgment call, not a statistic — the report will frame this as a risk-weighted recommendation, not a fabricated percentage.

## Stop criteria

- ≥3 independent, differently-typed sources per hypothesis before synthesis.
- Legal/policy workstream (C) requires at least one primary-source citation (Google's own policy pages) per policy claim; commentary alone isn't sufficient to close that claim.
