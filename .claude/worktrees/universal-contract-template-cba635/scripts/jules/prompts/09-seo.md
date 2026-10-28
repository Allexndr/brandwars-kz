Build homepage, i18n, and SEO. Read docs/brandwars-kz-master-prd-and-spec.md sections 14.1, 20, 12.

Requirements:
- / homepage: hero with mini map preview, live counters (brands count, season, total support), CTAs "Занять территорию" + "Открыть карту", top-3 events, category leader cards, "How it works" 3 steps, trust block
- next-intl: ru-KZ (default) and kk-KZ with hreflang in layout
- Legal pages: /rules, /privacy, /terms — safe copy from PRD §12 (no disparaging competitors)
- Schema.org JSON-LD: Organization, WebSite with SearchAction on layout
- Dynamic OG images via @vercel/og for /brand/[slug] and /category/[slug]
- All sponsored content labeled "Реклама" or "Спонсируемый слот"
- sitemap.xml and robots.txt

Acceptance: / renders in ru and /kk renders in Kazakh; OG meta tags present on brand pages.
