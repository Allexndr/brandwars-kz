# 36 — Upstash Serverless Redis for Real-Time Leaderboards

- URL: https://upstash.com/ / https://upstash.com/redis
- Accessed: 2026-08-27
- Source type: primary
- Credibility (1-5): 5 — Official Upstash documentation
- Recency: 2026
- Bias notes: None

## Verbatim quotes

> "you will see 5-15ms response times depending on your region"
> "for ultra-low-latency use cases like real-time gaming leaderboards, it might not be suitable"
> "REST API means Redis commands can be sent over HTTP — no TCP connection required"

## Relevance

Upstash is Vercel Marketplace partner. REST API over HTTP (no persistent TCP) suits Vercel edge. Global replication (8+ regions) provides low-latency reads. Caveat: 5-15ms baseline latency; competitive "buy now to rank #1" leaderboards may need <100ms end-to-end, pushing toward local caching or external service. Supports sorted sets for rankings, pub/sub for updates.

