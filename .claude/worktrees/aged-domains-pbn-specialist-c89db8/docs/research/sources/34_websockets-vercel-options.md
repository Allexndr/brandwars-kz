# 34 — WebSocket Real-Time Options on Vercel

- URL: https://ably.com/vercel/websockets-on-vercel
- Accessed: 2026-08-27
- Source type: primary
- Credibility (1-5): 5 — Ably is official Vercel Marketplace partner
- Recency: 2026
- Bias notes: Ably promotes its own service; comparison fair but vendor-sponsored

## Verbatim quotes

> "established connections are pinned to the function for its maximum duration"
> "default 5-minute timeout (30 minutes on Pro/Enterprise plans)"
> "Vercel's Knowledge Base page on WebSocket support still recommends this for anything beyond a single-instance connection"

## Relevance

Native Vercel WebSocket support (beta since June 2026) unsuitable for leaderboard broadcasts: single-instance, session-scoped, lacks fan-out or delivery guarantees. For competitive real-time updates, requires either external WebSocket server (Fly.io, Railway) or third-party provider (Ably, Pusher, etc.). Production recommendation: managed real-time service.

