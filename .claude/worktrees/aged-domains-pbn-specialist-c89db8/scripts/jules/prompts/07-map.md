Build 2D map with PixiJS. Read docs/brandwars-kz-master-prd-and-spec.md sections 14.2-14.3, 16.

Requirements:
- /map — planet overview, 6 category continents as clickable regions
- /category/[slug] — PixiJS canvas showing brand territories as colored cell clusters
- Load sprites from public/assets/categories/{slug}/ (leader.png, building-*.png, prop-*.png)
- image-rendering: pixelated CSS on canvas wrapper
- Pan and zoom controls, mobile-friendly touch
- Poll GET /api/map/categories/:slug every 45 seconds
- Click territory → overlay with compact brand card (name, rank, link to /brand/[slug])
- Leader change: brief highlight animation
- NO WebSocket, NO Three.js

Use assets/ folder structure already in repo. Fallback colored rectangles if sprite missing.

Acceptance: /map and /category/travel render with demo seeded brands.
