# Plan — Kazakhstan "battle-for-rank" advertising platform

## Changelog
- 2026-08-27: Initial plan, written after clarification round with founder.

## Origin & reframe

Founder request: a full product spec (ТЗ) for a Kazakhstan advertising platform inspired by two references:
- **milliondollartoilet.com** — novelty site, 3D toilet model, people pay to place ads on it, live donation counter, reportedly $120k earned.
- **topbrands.kz** — Kazakhstan pay-to-rank business leaderboard. Confirmed via fetch: businesses list *themselves*, highest payer holds #1 until outbid, minimum 1,000₸, current #1 costs 11,500₸. Founder's own stats: 10,000+ visitors, 40,000₸+ sales, 40-50 avg business visits/12h in the first 24 hours.

The original ask included a mechanic where Company A could place Company B (a **non-consenting competitor**) in a deliberately weak/mocking ranked position, forcing B to pay to escape it. This was flagged to the founder as squarely inside Kazakhstan's Law "On Competition" Art. 16 (discreditation / incorrect comparison with a competitor = unfair competition) and the Law "On Advertising" (bans ads that discredit/humiliate/ridicule a party) — confirmed via live search, not just recalled from training data. Founder agreed to pivot.

**Reframed question**: What is the highest-hype, highest-revenue version of a gamified, fully opt-in "battle for rank" advertising platform we can build nationwide in Kazakhstan — every participant a consenting, paying business, nobody targeted without their own action — that we can fully spec (architecture, pages, design, SEO/geo) and hand to engineering?

## Founder decisions (from clarification round, verbatim intent preserved)

1. **Mechanic**: Rejected a plain topbrands.kz clone as "not interesting enough." Wants hype and a "battle/war" layer — companies "war" with other companies on the platform for position; open to browser-game framing, "could be anything" as long as it has hype, a clear idea, and stays simple. Also explicitly still wants companies to be able to place themselves on the toilet-style novelty visual.
   → **Working interpretation** (stated back to founder, not yet re-confirmed): PvP-style outbidding — a business can spend to "attack"/take a contested ranked spot, the incumbent can spend to "defend"/retake it. Both sides are always consenting, paying participants. No claims are ever made about either business's actual products/quality — the "battle" is purely a numeric bidding contest with a game skin on top. This is the load-bearing legal distinction (see Workstream B).
2. **Vertical**: Founder said "not sure — recommend one." Must be justified with market evidence in the final ТЗ, not asserted.
3. **Geography**: Nationwide Kazakhstan at launch (explicitly rejected single-city-first).
4. **Brand tone**: Cheeky/novelty confirmed — toilet/throne visual gimmick, humor in copy, live counters, countdown timers, "hype" as an explicit success metric.

## Falsifiable hypotheses

- **H1**: A gamified "battle for rank" (PvP attack/defend framing) drives higher per-user spend and virality than a static leaderboard (topbrands.kz baseline), via loss-aversion ("your spot is under attack") vs. a flat "buy rank" CTA.
- **H2**: The novelty toilet/throne visual gimmick can work as a viral acquisition hook while a broader multi-category directory underneath carries durable revenue — i.e., novelty and business model are separable, the way Million Dollar Homepage's gimmick didn't require every buyer to be a novelty act.
- **H3**: Nationwide KZ launch adds limited incremental legal/compliance burden vs. single-city, provided the mechanic stays fully opt-in — i.e., the legal risk in the original ask was specifically about non-consensual targeting, not about geographic scope.
- **H4**: A "battle" mechanic framed as a pure numeric bidding contest (zero comparative/disparaging product claims) stays outside Kazakhstan's unfair-competition and advertising-disparagement statutes.

## Genre & blocks

Custom: landscape + decision (vertical/mechanic choice, evidence-backed) feeding a build-ready PRD/ТЗ block — page-by-page spec, architecture, design system, SEO/geo plan. Deliverable extends past a standard research report per explicit founder request ("представь что ты фулл-стек продукт девелопер").

## Sourcing strategy — parallel workstreams

| # | Workstream | Scope | Source file range |
|---|-----------|-------|--------------------|
| A | Genre & competitor research | Million Dollar Homepage lineage + clones' survival/decay, other novelty-counter sites, topbrands.kz deep teardown, gamified PvP-leaderboard UX precedent (Twitch sub wars, mobile guild-war monetization, Product Hunt-style boards) | sources/01–10 |
| B | KZ legal & regulatory | Law "On Competition" Art. 16, Law "On Advertising", gambling-classification risk for "highest bidder wins" mechanics, business registration (ИП/ТОО), tax treatment, ToS/consent requirements | sources/11–20 |
| C | KZ market & SEO landscape | Yandex vs Google KZ share, 2GIS's role, Kazakh vs Russian SEO split + any language-quota rules, dominant SMB marketing channels, mobile/desktop split, ad spend by category (→ vertical recommendation) | sources/21–30 |
| D | Payments & tech implementation | Kaspi Pay + Epay + alternatives, data residency rules, Vercel region/latency fit, realtime leaderboard implementation options, KZ SMS/OTP verification norms | sources/31–40 |

## Opposition / adversarial queries (Phase 6)

- Could "battle" framing read as humiliation even without explicit product claims (e.g. a rival visually "defeated"/"dethroned") — does that cross into Art. 16 territory anyway?
- Could nationwide-first actually be worse than single-city (thin density, harder seeding, diluted local SEO)?
- Could the toilet novelty theme hurt credibility for higher-ticket B2B categories?
- What actually happened to Million Dollar Homepage clones after the novelty faded — is H2 survivorship bias?

## Risk register

- No paid SEO/market-intel API available this session (Ahrefs/Similarweb plugins unauthenticated) → volume/spend claims triangulated from free sources only, flagged lower-confidence where relevant.
- H4's legal safety rests on a substance/effect test, not just statute wording — must be checked against real Art. 16 guidance/examples in the adversarial pass, not assumed from the text alone.
- milliondollartoilet.com is JS-rendered and didn't return content via fetch — relying on founder's description + genre research for that comp; flagged, not fabricated.

## Stop criteria

- ≥3 independent, differently-typed sources per hypothesis before synthesis.
- Legal workstream (B) requires at least one primary-source statute citation per claim; commentary alone isn't sufficient to close a claim.
