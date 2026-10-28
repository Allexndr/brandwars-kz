# 16 — Ahrefs' Own Infrastructure Cost (why the index is hard to replicate)

- URL: https://tech.ahrefs.com/how-ahrefs-saved-us-400m-in-3-years-by-not-going-to-the-cloud-8939dd930af8
- Accessed: 2026-08-27 (via a text-extraction proxy, r.jina.ai, after direct WebFetch of tech.ahrefs.com returned HTTP 403 to this agent twice)
- Source type: primary
- Credibility (1-5): 5 (Ahrefs' own engineering team describing their own infrastructure and its real cost, with concrete hardware specs and cost math, not just marketing copy)
- Recency: original publication is a few years old (widely recirculated on Hacker News/Lobsters, which is how it surfaced in current 2026 searches) — the specific dollar figures may be stale, but the order-of-magnitude scale is the relevant, still-valid takeaway
- Bias notes: Company's own blog with a self-congratulatory framing ("we out-engineered the cloud"), so the "we were right to avoid AWS" argument should be read skeptically — but the underlying hardware specs and comparison arithmetic are technical and verifiable, not just marketing claims, so the raw scale figures are treated as credible.

## Verbatim quotes

> "We would need to pay AWS a whopping ~USD 400 million more to keep our infrastructure running in Singapore"

> "Ahrefs has saved ~USD 400 million by ensuring its infrastructure is NOT 100% in the IaaS cloud during the last 2½ years"

> "So let's say we run our 850 servers during the actual 2½ years of our data center usage"

> "We use high core-count CPUs, 2TB RAM, and 2x 100Gbps per server. On average, our servers have about 16x 15TB drives"

> "A replacement EC2 instance with similar usable SSD space in AWS would cost us roughly the same amount of money for 11.3 servers in a colocation data center"

## Relevance

This is the single strongest piece of evidence for H2 found across this entire workstream. Ahrefs runs on the order of 850 physical servers (each with 2TB RAM and ~240TB of raw disk, implying on the order of 100+ petabytes total) just to sustain its crawler and index — and even having deliberately avoided cloud markup to save money, the underlying on-prem spend is still large enough that the avoided AWS cost alone is quoted at ~$400 million over 2.5 years. This is many orders of magnitude beyond any indie/solo budget, and it only covers infrastructure — not the ~13 years of continuous crawl history (since ~2013, per other sources found this session) that gives Ahrefs' historical index its value. For H2, this confirms that replicating an Ahrefs/Majestic-quality proprietary crawled index from scratch is not viable for a solo builder at any reasonable budget; the only economically rational path is renting data through an existing API (DataForSEO, Majestic, Ahrefs itself) rather than attempting to own a competing index.
