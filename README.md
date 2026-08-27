# BrandWars.kz

Живая игровая рекламная платформа для брендов Казахстана — браузерная 2D-карта с сезонными рейтингами, территориями и «туалетным» юмором в безопасной форме.

## Документация

- [Мастер PRD и спецификация](docs/brandwars-kz-master-prd-and-spec.md)
- [Концепция и ТЗ](docs/Игровая%20рекламная%20платформа%20с%20«туалетным»%20юмором%20для%20брендов%20в%20Казахстане.md)
- [Research](docs/research/)
- [Гайд по 2D-ассетам](docs/prs)
- [Jules prompts](scripts/jules/prompts/)

## Стек (MVP)

- Next.js 15 + TypeScript + App Router
- PostgreSQL + Prisma
- PixiJS (2D-карта)
- Tailwind CSS + shadcn/ui
- next-intl (`ru-KZ`, `kk-KZ`)
- NextAuth v5
- Vercel

## Быстрый старт (после scaffold)

```bash
cp .env.example .env.local
pnpm install
docker compose up -d
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

Открой [http://localhost:3000](http://localhost:3000).

## Jules — автоматизация разработки

```bash
export JULES_API_KEY=your_key_here

# Создать сессию
./scripts/jules/run-session.sh "$(cat scripts/jules/prompts/01-scaffold.md)" "feat: project scaffold"

# Дождаться PR
./scripts/jules/poll-session.sh SESSION_ID
```

Каждая Jules-сессия стартует **после merge** предыдущего PR в `main`.

## Структура

```text
docs/           # PRD, research, ТЗ
assets/         # 2D спрайты и style bible
scripts/jules/  # оркестратор Jules API
```

## Лицензия

Proprietary — BrandWars.kz
