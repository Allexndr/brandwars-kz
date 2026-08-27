Implement user wallet and community support. Read docs/brandwars-kz-master-prd-and-spec.md sections 6, 14.9.

Requirements:
- /profile — daily energy (1 free support/day), favorite brands, support history, badges stub
- Wallet model with in-game currency balance
- POST /api/support-actions — free daily support (+small battle power weight) and paid support stub
- GET /api/wallet, POST /api/wallet/purchase (stub/test mode)
- Rate limits: 1 free support per brand per day per user, max 10 actions/hour
- Basic antifraud: trust score field on user, block if score < threshold
- Support actions feed into Battle Power recalculation (lower weight than brand spend)

Acceptance: logged-in user can support a brand once per day; second attempt same day returns 429.
