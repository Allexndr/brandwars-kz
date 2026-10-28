Build admin moderation panel. Read docs/brandwars-kz-master-prd-and-spec.md section 11.

Requirements:
- /admin/moderation — queue of pending brand claims and verifications
- Moderator sees: name, category, URL, metadata, email domain, similar brand matches, history
- Actions: approve, reject, request_proof, conditional_verify — each writes ModerationCase + AuditLog
- /admin — dashboard stub with links to moderation, seasons, payments
- APIs from PRD §18 admin block:
  GET /api/admin/moderation
  POST /api/admin/moderation/:id/approve
  POST /api/admin/moderation/:id/reject
- Only moderator/admin roles can access
- On approve: brand status → verified or conditionally_verified, create Territory entry in active season

Acceptance: moderator can approve a claim and brand appears in GET /api/brands.
