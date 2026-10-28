# 32 — Vercel Global Regions & Infrastructure

- URL: https://vercel.com/docs/regions
- Accessed: 2026-08-27
- Source type: primary
- Credibility (1-5): 5 — Official Vercel documentation
- Recency: 2026-08-11 (current)
- Bias notes: None

## Verbatim quotes

> "126 PoPs distributed across the globe"
> "20 compute-capable regions where your code can run close to your data"
> "Functions should be executed in the same region as your database, or as close to it as possible, for the lowest latency"

## Relevance

Vercel operates 20 compute regions including Frankfurt (fra1, eu-central-1), Paris (cdg1, eu-west-3), Dublin (dub1, eu-west-1), and London (lhr1, eu-west-2). No region in Kazakhstan; Frankfurt is closest at ~3500km. Default region (iad1) is Washington D.C.; region selection affects function execution latency. For KZ audience, fra1 (Frankfurt) recommended for ~40-50ms latency from Almaty.

