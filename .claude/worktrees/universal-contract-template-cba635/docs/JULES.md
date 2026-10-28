# Jules Integration

## Status

- Orchestrator scripts: `scripts/jules/run-session.sh`, `poll-session.sh`, `run-all-sessions.sh`
- Prompts for 10 MVP sessions: `scripts/jules/prompts/01-scaffold.md` … `10-polish.md`
- **GitHub App**: install at [jules.google.com](https://jules.google.com) → Settings → connect `Allexndr/brand_wars`

## Verify connection

```bash
export JULES_API_KEY=your_key   # rotate if previously exposed
./scripts/jules/list-sources.sh
# Expected: sources/github/Allexndr/brand_wars
```

## Run a session

```bash
./scripts/jules/run-session.sh --file scripts/jules/prompts/07-map.md "feat: pixijs map"
./scripts/jules/poll-session.sh $(cat .jules/latest-session)
```

## MVP note

Full MVP (sessions 1–10) is implemented on `main`. Use Jules for:
- bug fixes and PRD gap analysis
- post-MVP features (WebSockets, Kaspi prod, 3D planet)

Example review prompt:

```text
Review BrandWars.kz on main against docs/brandwars-kz-master-prd-and-spec.md.
Fix any missing MVP acceptance criteria. Open a PR with fixes only.
```
