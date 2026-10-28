# 17 — Google Search Essentials: Spam Policies (Link Spam & Expired Domain Abuse)

- URL: https://developers.google.com/search/docs/essentials/spam-policies (the legacy "link schemes" URL, support.google.com/webmasters/answer/66356, and developers.google.com/search/docs/advanced/guidelines/link-schemes, both 301-redirect here — Google has consolidated its link-manipulation rules into this single spam-policies document)
- Accessed: 2026-08-27
- Source type: primary
- Credibility (1-5): 5 (Google's own official Search Central documentation — this is the operative rule text, not commentary about it)
- Recency: page shows "Last Updated: 2026-05-15 UTC"
- Bias notes: Google has an obvious incentive to discourage link manipulation that would undermine the integrity of its own ranking signals, and to characterize such manipulation as harmful to users. That said, this is the actual rule text that anyone building or using PBN-sourcing tooling is directly exposed to — it is the single most load-bearing source in this workstream regardless of Google's motives for writing it.

## Verbatim quotes

> "Link spam is the practice of creating links to or from a site primarily for the purpose of manipulating search rankings."

Examples of link spam listed on the page:

> "Buying or selling links for ranking purposes. This includes: Exchanging money for links, or posts that contain links; Exchanging goods or services for links; Sending someone a product in exchange for them writing about it and including a link"

> "Excessive link exchanges ("Link to me and I'll link to you") or partner pages exclusively for the sake of cross-linking"

> "Using automated programs or services to create links to your site"

> "Requiring a link as part of a Terms of Service, contract, or similar arrangement"

> "Text advertisements or text links that don't block ranking credit"

> "Advertorials or native advertising where payment is received for articles that include links"

> "Low-quality directory or bookmark site links"

> "Keyword-rich, hidden, or low-quality links embedded in widgets"

> "Widely distributed links in the footers or templates of various sites"

> "Forum comments with optimized links"

> "Creating low-value content primarily for the purposes of manipulating linking and ranking signals"

On expired domains specifically (a distinct named policy on the same page, "Expired domain abuse"):

> "where an expired domain name is purchased and repurposed primarily to manipulate search rankings by hosting content that provides little to no value to users"

Examples given: "Affiliate content on a site previously used by a government agency" and "Casino-related content on a former elementary school site."

Enforcement language:

> sites violating these policies "may rank lower in results or not appear in results at all."

## Relevance

This is the ground-truth definition of exactly what a PBN does — creating a network of sites/links "primarily for the purpose of manipulating search rankings" — and Google's own text confirms that Google treats this as a policy violation carrying ranking demotion or removal, not a neutral tactic. Notably, the page never uses the terms "private blog network" or "PBN" — Google defines the violation by the *activity* (link spam, expired-domain abuse) rather than by naming the tactic, meaning any tool built around aged-domain sourcing sits squarely inside an activity-based prohibition even if it never uses the word "PBN." This directly substantiates H3's premise that the buyer segment's core use case is a first-party-documented platform violation, not just something forums call risky.
