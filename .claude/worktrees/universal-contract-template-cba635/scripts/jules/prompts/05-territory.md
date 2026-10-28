Implement Battle Power and territory calculation engine. Read docs/brandwars-kz-master-prd-and-spec.md sections 6-7, 17.

Core logic (server-side only):
- Battle Power = confirmed brand spend + weighted community support + event bonuses - antifraud corrections
- Territory Share = sqrt(Battle Power) / sum(sqrt(Battle Power)) per season_category
- Recalculate on: payment confirmed, support action, admin trigger
- Store in territories table with rank, visual_level, capital_level

Rank statuses (map battle_power rank in category):
- Новичок (new), Претендент (top 10), Великая держава (top 3), Лидер категории (#1)

APIs:
- GET /api/map — all categories with territory summaries
- GET /api/map/categories/:slug — full category map data
- GET /api/leaderboard?category=&period=season|24h|community
- POST /api/admin/recalculate (admin only)

Leaderboard snapshots table for history. Cache hot leaderboard in Redis if UPSTASH configured, fallback to DB.

Acceptance: seed 3 demo brands in travel category with different spend → territory shares follow sqrt formula.
