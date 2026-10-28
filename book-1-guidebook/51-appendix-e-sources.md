# Приложение E. Источники и что читать дальше

Срез ресерча: **15 августа 2026**. Полные URL и номера — в файлах `research/`. Это указатель: куда идти за каноном, что читать как книгу, что сгниёт первым. Не библиография на 400 строк — она уже в досье.

## E.1. Досье проекта (канон цифр для глав)

Писать главу «из головы», не открыв досье, — нарушение процесса (`research/00-sources-index.md`).

| Досье | Файл | Главный потребитель в Книге 1 |
|---|---|---|
| Архитектура и масштаб | `research/01-architecture-and-scale.md` | 9–15, частично 16–17, 21–22, 45 |
| DevOps, SRE, платформа | `research/02-devops-sre-platform.md` | 23–26, A.3 |
| Данные, ML, AI | `research/03-data-ml-ai.md` | 18, 27–30 (тонкое: дополнять 04 и 05) |
| Безопасность, privacy | `research/04-security-privacy-compliance.md` | 32–34, A.5–A.6 |
| Стратегия, рост, экономика продукта | `research/05-product-strategy-growth.md` | 4–7, 28, 37–39 |
| UX, фронт, мобайл | `research/06-ux-design-frontend-mobile.md` | 19–20, 35–37 |
| Качество, поддержка, доки | `research/07-quality-support-docs.md` | 31, 43 |
| Организация, культура, найм | `research/08-org-teams-culture.md` | 8, 41–42, частично 44.3 |
| Финансы, платежи, право | `research/09-finance-payments-legal.md` | 40, 44, C.4, B.10 |

Книга 2 своих досье не имеет: исполняет Книгу 1. Маршрутизация этапов — `research/00-sources-index.md` §1.

Конфликты тем (PCI, SOC 2, Redis/Valkey, Rule of 40): канон глубины указан в индексе §2.3 — не плодить две вилки цен.

## E.2. Книги и длинные тексты (принципы переживают тул)

Читать как механизмы, не как ритуалы копирования.

- Brooks — *The Mythical Man-Month* (1975): каналы n(n−1)/2, добавление людей на поздний проект.
- Conway — «How Do Committees Invent?» (1968): закон Конвея.
- Skelton & Pais — *Team Topologies*: типы команд, режимы, cognitive load.
- Reinertsen — *The Principles of Product Development Flow*: WIP, очереди, CoD, утилизация ρ/(1−ρ).
- Forsgren, Humble, Kim — *Accelerate* / программа DORA: доставка как система; отчёты 2023–2025 обязательны поверх книги (ярлыки elite сняты в 2025).
- Google — *SRE Book* и Workbook: SLO, error budget, PRR, launch checklist.
- Google — *Software Engineering at Google*: размер vs скоуп тестов, brittle tests.
- Nygard — ADR (2011) + Thoughtworks Radar: ADR в VCS.
- Fowler — Money pattern; *Patterns of Enterprise Application Architecture*.
- Klein — «Performing a Project Premortem», HBR 2007; Mitchell et al. 1989 prospective hindsight.
- Sackett, Zhang, Berry & Lievens — JAP 2022: пересмотр валидностей отбора (не Schmidt & Hunter 1998 как актуальные r).
- Larson — *Staff Engineer* / staffeng.com: архетипы; Goedecke — критика «это не план».
- Basecamp — *Shape Up*.
- Amazon — Working Backwards / PR-FAQ / Bar Raiser (Bryar & Carr).
- GitLab Handbook — async, handbook-first, пределы async.
- Netflix Culture memo (версия 2024).
- Diátaxis (diataxis.fr) — документация.
- Dean & Barroso — «The Tail at Scale», CACM 2013.
- Bloom, Han & Liang — hybrid RCT Trip.com, Nature 2024.
- PCI DSS v4.0.1; ISO/IEC 27001:2022; ISO/IEC 42001:2023 — тексты стандартов, не блоги.
- AGPLv3, BSL 1.1, лицензии Redis 8 / Valkey — юридический канон инфры 2025–26.

Карьерные лестницы как образцы: Dropbox Engineering Career Framework; агрегатор progression.fyi.

## E.3. Бумаги и отчёты, которые часто цитирует эта книга

Повторно открывать первоисточник, не пересказ в главе.

- DORA Accelerate / State of DevOps 2023, 2024, 2025; DORA documentation-quality capability.
- METR 2025 — RCT опытных OSS-мейнтейнеров (−19%).
- Peng et al. 2023 — лабораторный Copilot +55,8%.
- MIT/Microsoft/Accenture полевые RCT Copilot (2024).
- GitClear AI code quality 2025 (211 млн строк).
- Faros / разборы DORA 2025 — телеметрия ревью и инцидентов на PR.
- Stanford/ADP Canaries 2026 — junior employment.
- IZA DP 18723 Lightcast — junior vs senior vacancies.
- SmartBear/Cisco code review 2006; Sadowski et al. Google modern code review ICSE-SEIP 2018.
- Inozemtseva & Holmes ICSE 2014 — coverage vs effectiveness.
- Recurly churn benchmarks июль 2026.
- Carta State of Private Markets Q1 2026.
- PitchBook-NVCA Venture Monitor Q2 2026.
- SaaS Capital spending survey март 2026; Benchmarkit 2026.
- Kaspi.kz 20-F FY 2025 (SEC) — локальные платежи как пример.
- Stripe Newsroom: Metronome closing 14.01.2026; Sessions 2026 Radar/AI fraud.
- Adyen press: Orb $335M 11.06.2026.
- PCI SSC: v4.0.1; future-dated 31.03.2025; FAQ 1574 CVV.
- Еврокомиссия ViDA; Directive (EU) 2025/516.
- McKinsey tech debt; Stripe Developer Coefficient.
- Scholtes et al. 2016 — размер команд OSS / Рингельман.

Полные URL — хвост каждого `research/0N-*.md`.

## E.4. Что гниёт быстро (не вшивать «навсегда»)

Обновлять по C.5; при сомнении — «на дату среза».

- Пороги Visa VAMP / Mastercard ECM — fact sheet эквайера, менялись 2025–26.
- Комиссии Stripe/Adyen — контракт ≠ публичный прайс.
- Recovery dunning 55–75% — вендоры, нет открытого RCT.
- Rule of 40 медиана 28%, мультипли EV/NTM — вторичные компиляции.
- Стоимости SOC 2 / ISO / PCI ROC — вилки ×3–5 по стране и scope.
- Число ISO 42001 сертификатов — нет официального реестра.
- npm-загрузки Playwright — прокси CI, не число команд.
- Klarna CSAT −22% — вторичка, первично не подтверждено.
- Внутренние flake-цифры Google после 2017 — публично не обновлялись.
- Deque 57,38% a11y — исследование ~2021.
- Пороги Play/App Store, CWV, Target SDK — ежегодно.
- Redis/HashiCorp лицензии, sunset моделей LLM — продуктовый риск недель–месяцев.
- Carta/PitchBook кварталы — не складывать ряды; AI-концентрация меняет медианы.
- Kaspi/Halyk интеграционные URL третьих лиц — не канон API.
- E-invoicing (KSeF, ЭСФ, ViDA транспозиция) — указы сдвигают даты.
- DORA самоотчёт vs ваша телеметрия — разные вселенные; архетипы 2025 могут пересобрать в следующем отчёте.
- Инструменты: Kubernetes Gateway API, WebTransport Baseline (март 2026), Metronome-vs-Meters — принцип (контракт, деградация, buy vs build) переживает бренд.

## E.5. Как читать «дальше» по роли

- **Фаундер соло:** Главы 4–7, 40, 44, 46.1–46.2, A.1, B.1, B.10. Книга 2 — halt на деньгах.
- **Техлид 10–30:** 10–12, 23–26, 41–42, A.2–A.4, B.2–B.7. Досье 01, 02, 08.
- **Staff / архитектор:** 11–15, 22, 32, 45, fitness и ADR. Досье 01, 04, 09 (лицензии).
- **Агент:** Книга 2 целиком + эта Книга 1 по маршрутизатору; запрет додумывать цифры (E.4, C.5 пункт 10).

## E.6. Чего в корпусе не хватило на срез 15.08.2026

Смотреть хвосты «пробелы» в досье. Коротко: сумма сделки Stripe–Metronome официально не раскрыта; закрытие Adyen–Orb после 01.07.2026 сверять пресс-релизом; отраслевого канона escaped defect нет; IAP 30% / DMA — дыра для мобайл-монетизации; юридический анализ AGPL Lago — только counsel; Travel Rule/MSB для кошельков маркетплейса не сводился. В главу в этих местах — «не установлено», не оценка из LinkedIn.
