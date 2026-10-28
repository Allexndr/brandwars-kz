# 12 — Wayback Machine / CDX API Rate Limits

- URL: https://archivarix.com/en/blog/webarchive-2026/
- Accessed: 2026-08-27
- Source type: industry
- Credibility (1-5): 3 (third-party technical blog; author, Archivarix, is itself a company that resells/repackages Wayback Machine data for website-restoration customers, giving it practitioner-level accuracy incentive but also a commercial interest in customers not just hitting the free API themselves)
- Recency: dated as a 2026 retrospective ("Web Archive in 2026: What Has Changed")
- Bias notes: Written by a vendor whose own paid product competes with/wraps the free API it's describing — plausible the piece frames direct API use as harder than it is to nudge readers toward Archivarix's own service. Cross-check: an initial broader web search independently returned the same "60 requests per minute" figure before this page was fetched directly, which corroborates it.

## Verbatim quotes

> "The CDX API allows an average of 60 requests per minute. When the limit is exceeded, the server responds with a 429 (Too Many Requests) code."

> "If the client continues to ignore 429 responses for more than a minute, the IP address is blocked at the firewall level for one hour. Each subsequent violation doubles the blocking time."

> "Major news publishers began restricting Internet Archive crawlers' access to their websites" ... "The New York Times completely blocked archive.org crawlers"

## Relevance

The Wayback/CDX API itself carries no dollar cost — a genuine structural advantage over Ahrefs/Majestic/WhoisXML for this specific data leg. At 60 requests/minute, checking "hundreds of candidate domains monthly" (the task's stated volume) is trivial: even a few CDX calls per domain for a few hundred domains finishes in well under an hour of runtime, with no subscription fee. This is a concrete data point cutting against H2's pessimism for the Wayback-history leg specifically — free access is not the bottleneck at indie scale — though the escalating IP-ban penalty means a builder must engineer polite, cached, low-concurrency access rather than naive bulk-hammering.
