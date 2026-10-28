# 35 — Vercel Real-Time Data Publishing & Subscriptions

- URL: https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel
- Accessed: 2026-08-27
- Source type: primary
- Credibility (1-5): 5 — Official Vercel Knowledge Base
- Recency: 2026
- Bias notes: None

## Verbatim quotes

> "a live relay for the clients currently in the room, and a durable log for a client that joins mid-conversation"
> "SSE stays on standard HTTP with no upgrade handshake, and browsers reconnect on their own"

## Relevance

For leaderboards, recommends Redis Streams (chat/messaging) or Redis pub/sub with sorted sets (presence/rankings). Marketplace-provided Redis (e.g., Upstash) handles multi-instance broadcast via Vercel Functions. Marketplace partners: Ably, Convex, Firebase, Liveblocks, PubNub, Pusher, Supabase, TalkJS. For 1,000+ concurrent users bidding on leaderboard spots, managed service strongly advised.

