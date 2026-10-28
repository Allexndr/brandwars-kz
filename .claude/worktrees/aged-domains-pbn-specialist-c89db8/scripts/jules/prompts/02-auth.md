Add authentication and RBAC to BrandWars.kz. Read docs/brandwars-kz-master-prd-and-spec.md.

Requirements:
- NextAuth v5 (Auth.js) with Prisma adapter
- Providers: email magic link + Google OAuth
- User roles enum: user, brand_owner, moderator, admin (store on User model)
- Middleware protecting /dashboard/* and /admin/* — redirect unauthenticated to /login
- Pages: /login, basic app layout with header (logo, nav: map, categories, brands, rules), footer, language switcher stub (ru/kk)
- RBAC helpers: requireRole(), isAdmin(), isModerator()
- Session includes user id and role

Do NOT implement brand flows yet. Keep existing Prisma schema, extend User if needed.

Acceptance: auth flow works in dev with email provider stub; middleware blocks /admin for non-admin users.
