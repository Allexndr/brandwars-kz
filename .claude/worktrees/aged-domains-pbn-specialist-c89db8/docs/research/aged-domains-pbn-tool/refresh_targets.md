# Refresh targets — aged-domains/PBN tool investigation

Run an `update aged-domains-pbn-tool` pass against these when re-checking this investigation. Each item names what to re-query and why it could flip a conclusion.

## Pricing (H2 — re-check every 3-6 months, these move often)
- Ahrefs API pricing — no stable public price sheet as of 2026-08-27 (sources/09); re-check by opening a trial account rather than trusting secondary sources again.
- Majestic API tier price (sources/10: $399.99/mo as of 2026-08-27) — watch for a cheaper pay-as-you-go tier appearing.
- DataForSEO backlinks pricing (sources/14: $0.024/request + $0.000036/row as of 2026-08-27, post a July 2026 price change) — this is the load-bearing "cheap data" number for the whole feasibility case; if it rises sharply, H2's "rent don't build" conclusion weakens.
- WhoisXML WHOIS History "DRS credit" to dollar conversion — unresolved in this pass (source 11); worth resolving directly via a trial account before committing to a data-cost model.

## Policy/enforcement (H3 — re-check after any named Google spam/core update)
- status.search.google.com spam-update history (source 18) — check for new entries since Aug 2026.
- Whether Google ever names "expired domain abuse" or "PBNs" explicitly in a future policy update (source 17 currently defines by activity, not by the PBN label).
- Any new large-scale PBN deindexing case study surfacing publicly (comparable to sources 20, 25) — recurrence would strengthen H3; a multi-year gap with no new case studies would weaken it.

## Market/demand signals (H1/H4)
- Re-run the Glassdoor/Indeed/ZipRecruiter search for "PBN specialist" / "expired domain specialist" (source 32) — if a dedicated job category emerges, the addressable labor market this app would target has grown.
- Re-check whether SpamZilla, DomCop, or a new entrant has shipped a content-category classifier (casino/adult/pharma/hacked-history) since 2026-08-27 — this is the specific automation gap the opportunity depends on; a competitor closing it first materially changes the recommendation.
- Reporter Outreach's "State of Link Building" survey (source 26) is fielded periodically — a rerun with PBN reappearing as a named top-performing tactic would weaken H3's "budgets are shifting away" reading.

## Entities to track
- SpamZilla, ExpiredDomains.net, DomCop, Domain Hunter Gatherer — direct competitors/analogs.
- DataForSEO — the cheap-data dependency the "buildable MVP" path leans on; a pricing or ToS change here directly affects feasibility.
- AgedDoms.com — example of a curated-marketplace business model adjacent to the tool idea.

## Hypothesis status at time of writing (2026-08-27)
- H1 (demand gap): partially confirmed, narrower than assumed — see report.
- H2 (data cost infeasible): confirmed for owning a competing index, refuted for renting one — see report.
- H3 (policy/market risk): confirmed, with the category narrowing rather than disappearing — see report.
- H4 (automation ceiling): confirmed — see report.
