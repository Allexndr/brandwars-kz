# Глава 40. Платежи, биллинг и финансовая инфраструктура

*Коротко. Платёжный контур — слои: checkout, PSP, опциональная оркестрация, биллинг, ваш леджер, налог, риск, выплаты. PSP знает транзакцию; продукт знает заказ. Деньги — integer + валюта, идемпотентность, суточная сверка. Налог — фича, не «потом бухгалтерия».*

*Глава даёт маршрутизацию PSP и локальные методы, биллинг подписок/usage/кредитов на снимке 2026 (Stripe×Metronome 14 января 2026, Adyen×Orb 11 июня 2026), точность денег, НДС/ViDA/US nexus, dunning vs involuntary churn, чарджбэки и AI-фрод, маркетплейс/KYC и чек-лист запуска.*

*Фаундеру нельзя писать свой эквайринг и свой tax engine. Техлиду — нельзя считать Dashboard Stripe бухгалтерией. Staff — dual-PSP и токены как анти-SPOF.*

*Модель цены и AI-метры — Глава 6; формулы CAC/LTV/payback — Глава 7, здесь не повторяются. Фрод как T&S — Глава 34.5. PCI в широкой безопасности — Глава 32; здесь — CDE и что нельзя хранить. Burn компании — Глава 44.*

*Возвращайтесь, когда вебхук «потерялся», когда free AI-trial жжёт GPU, когда отток «продуктовый», а карта истекла, когда выходите в NL без iDEAL или в KZ без Kaspi.*

*Если статус «оплачено» берётся из редиректа фронтенда, у вас нет платежей. Есть надежда.*

Подключить Stripe — не архитектура. Рабочая модель — семь слоёв: UI чекаута (согласие, цена с налогом); PSP (авторизация, токен, settlement); оркестрация (роутинг, fallback); биллинг (подписки, usage, кредиты, инвойсы); леджер (остатки, начисления, сверки); tax engine; риск (фрод, dunning, диспуты); выплаты (split, escrow, KYC). Правило: **канонический статус заказа живёт у вас** после идемпотентной обработки вебхука, не в ответе Elements.

Независимый usage-billing к 2026 году съели платёжные платформы. Stripe закрыл покупку Metronome 14 января 2026: Collison назвал metering интерфейсом между продуктом и бизнесом; клиенты Metronome — OpenAI, Anthropic, NVIDIA. Для новых интеграций Stripe рекомендует Metronome, не Billing Meters API. Adyen 11 июня 2026 объявил покупку Orb за $335 млн кэшем (цель закрытия — 1 июля 2026; факт закрытия сверять на дату). OSS с self-host — Lago (AGPL). Принцип, который переживёт вендора: hot path лимитов у вас, rating/invoice может быть eventual.

PCI DSS 4.0.1 — единственная активная версия; 51 future-dated требование обязательны с 31 марта 2025, льготного периода нет. Самая дорогая ошибка — оказаться в CDE. Стратегия: hosted page / iframe / токены, никогда не касаться PAN. SAD (CVV, track, PIN) нельзя хранить после авторизации даже зашифрованными; согласие клиента не легализует CVV (PCI FAQ 1574).

Эта глава собирает деньги. Юнит-экономика решает, сходится ли когорта (Глава 7). Упаковка тиров — Глава 6. Инцидент «двойное списание» — Sev-1, не тикет finops.

## 40.1. Архитектура платежей: провайдеры, методы, регионы, резервные маршруты

**Stripe** — дефолт SMB/PLG: карты, кошельки, 100+ методов, Adaptive Pricing (локальная валюта в 150+ странах, курс на 24 ч; не на Payment Intents — только Checkout Sessions / Payment Links / hosted invoices). Когда: скорость, Billing+Tax+Radar в одном аккаунте, команда <30. **Adyen** — enterprise/omnichannel, локальный эквайринг, Interchange++ (на сайте ориентир processing fee + interchange + scheme + markup; публичный прайс ≠ ваш контракт). Когда: объём, много стран, прозрачный interchange. **Оба + оркестратор** (Primer, Spreedly): когда 1 п.п. authorization rate = миллионы или lock-in недопустим. Spreedly × PYMNTS (июнь 2026): полный стек оркестрации «более чем вдвое чаще» approval >97% — спонсировано, ⚠️. Не оркестрировать, пока один PSP закрывает методы: удвоение сверки съест выигрыш.

Метод выбирается по стране **плательщика** и валюте презентации, не по юрлицу продавца. Карты — универсальный fallback, не оптимальный rail. EU: iDEAL (~70% NL e-commerce, только EUR), Bancontact, BLIK, SEPA Debit, Klarna. LatAm: Pix. India: UPI. KR: Kakao/Naver/PAYCO. CN: Alipay/WeChat — отдельный compliance. KZ как пример локального монополиста: Kaspi Super App 15,7 млн Average MAU на 31.12.2025, 14,6 млн Payments Active Consumers, TPV ₸44 219 млрд за 2025 (Kaspi.kz 20-F); без Kaspi QR конверсия структурно ниже любой «глобальной» интеграции. Halyk ePay закрывает Visa/MC. Контракт с банком — критический путь, не «два дня на API».

Лестница отказов. Мягкий decline (issuer unavailable, do not honor, insufficient funds) → ретрай иначе/другой rail, не сразу второй PSP. Жёсткий (stolen, lost, pickup) → новый метод, не ретрай. PSP down → второй PSP, тот же network token если vault общий. Метод недоступен → следующий из упорядоченного списка, не «все сразу». 3DS fail → другой метод, не крутить challenge. Идемпотентность заказа на fallback обязательна: иначе двойное списание. `order_id` ваш; `payment_intent_id` — внешний ключ.

Автомат (не схлопывать): `created → pending_auth → authorized | declined | expired → captured | voided → refunded_* | disputed`. Authorized ≠ captured: разные деньги и сроки void.

Вебхуки: at-least-once, out-of-order, повторы (Stripe docs). Подпись по **raw body**. Дедуп `event.id` unique-индексом; повтор — 200 без сайд-эффекта. Игнорировать событие «из прошлого», если локальная версия новее. Хендлер: verify → persist → enqueue → 200 за <5 с; выдача доступа в воркере. Success URL не источник правды. Nightly pull PaymentIntents за окно и diff с леджером: потерянный вебхук — штат, не «раз в год».

SCA/PSD2: mandate на рекуррент языком, который выдержит диспут; первый платёж часто challenge. 3DS liability shift только если authentication прошла. Network tokens и Account Updater включать до писем dunning.

Для 1–3: один PSP, hosted checkout, выйти из CDE. Для 10–30: локальные методы целевых гео, вебхук-дисциплина, тестовая сверка. Для 100+: dual-PSP, оркестрация по порогу auth rate, network tokens как анти-lock-in.

Когда не второй PSP: «на слайде для инвестора». Чем платите за один: SPOF аккаунта (ToS, чарджбэки, санкции). Сигнал ошибки: оплата «успешна» в UI, леджер пуст.

## 40.2. Биллинг: подписки, прорейт, апгрейды, кредиты, usage-based тарификация

Двигатели выручки (выбор модели — Глава 6): seat/flat; usage/hybrid; take rate; MoR (Paddle) когда не хотите быть мерчантом в 40 странах. Биллинг должен уметь гибрид до того, как маркетинг объявит outcome (Bain, июнь 2026: ~10% outcome / 55% output / 35% effort среди AI-метров).

Выбор 2026. Подписка + немного metered, Stripe-only → Stripe Billing. AI/infra, контракты, кредиты, уже на Stripe → Metronome. PSP-agnostic и симуляции цены, готовность к орбите Adyen → Orb. Резидентность / OSS-комитет → Lago (AGPL: self-host модификаций может требовать открытия патчей — counsel, не блог). Lifecycle пауз и cancel-save → Chargebee/Recurly. Не строить ядро на preview-API Sessions.

Прорейт. Stripe `proration_behavior`: `create_prorations` | `always_invoice` | `none`. Classic vs flexible `billing_mode` считают иначе — смена на живой базе без ADR запрещена. Практика: апгрейд self-serve — сразу доначислить; даунгрейд — кредит до конца периода, фича режется сразу или в конце — продуктовое решение, зафиксировать. Год→месяц = новый контракт + unused credit. Prepaid credits — баланс в **вашем** леджере; PSP видит пополнение. Промо-кредит ≠ refund: разные счета, налог, отчёт. Price object в Stripe по сути immutable: новый Price, старым подпискам — явная миграция.

Usage. Контракт события: `idempotency_key`, внутренний `customer_id`, `metric`, целое `value`, `timestamp` с окном принятия, `dimensions` только тарифицируемые (кардинальность убивает). Два контура: **hot path** (лимит, hard stop) у вас realtime; **rating** eventual. Путать — bill shock или дырявый free tier. Для AI: hold+capture кредита **до** инференса или политика negative balance. Invoice-at-period-end при GPU = кредит продавца клиенту. Nalpeiron (июнь 2026, n=255): 13% полностью перекладывают inference на клиента, 44% абсорбируют — отложенный кризис GM (Глава 6.3).

Trial/free. Без карты — выше signup, выше фрод, ниже conversion. Stripe Sessions 2026: 1 из 6 attempted sign-up в AI — bad actor; trial abuse >×2 за 6 месяцев; Radar за месяц заблокировал >3,3 млн рискованных регистраций у восьми AI-компаний. Trial AI без карты = открытый GPU-бюджет: cap, Radar на signup, device binding. Entitlements — ваш quota-сервис, не «статус подписки в Dashboard»: отменили в кабинете, JWT живёт 30 дней — классика.

Биллинг-движок не заменяет: доступ (флаги/квоты); revenue recognition ASC 606 / IFRS 15; B2B net-30 с procurement (человек + CPQ).

Для 1–3: Billing + Tax, один тир, жёсткий cap free. Для 10–30: кредиты в своём леджере, версия Price. Для 100+: Metronome/Orb, enterprise commits, симуляция прайса на истории.

Когда писать свой rating: ≥2 из трёх — цена есть продукт с сотнями SKU; PSP физически не умеет commit/true-up; регулятор запрещает отдавать usage. Иначе год до хуже, чем Stripe Billing, без налога. Сигнал ошибки: Google Sheet AE как прайс enterprise.

## 40.3. Точность денег: типы, округления, валюты, идемпотентность, сверки

Fowler (PoEAA): Money = amount + currency; **никакого IEEE 754**. ISO 4217: USD/EUR/KZT — 2 знака, JPY/KRW — 0, KWD/BHD/JOD — 3. «Хранить центы» без кода валюты — баг для йены.

Канон: `BIGINT` minor units + `CHAR(3)` ISO, или `NUMERIC` со scale из таблицы валют; никогда `FLOAT`/`DOUBLE`/`number` в JS на деньгах. ORM не должен кастить в float. Округление: одно на продукт (half-even vs half-up), ADR, тесты на 0,5; налоги часто half-up в пользу бюджета — сверять юрисдикцию. Аллокация Fowler: $10 на 3 = 3,34+3,33+3,33, сумма инвариантна. FX: курс с источником и timestamp; Adaptive Pricing фиксирует 24 ч. Проценты считать от minor units, не float × 1.12 VAT.

Идемпотентность. Stripe: `Idempotency-Key` до 255 символов, кеш ≥24 ч, тот же ключ + другие параметры → 400; не PII. UUID на каждый ретрай = двойное списание. Детерминированный ключ: `order_id` + `attempt_purpose`. Слои: клиент→вы; вы→PSP (производный, не сырой); вебхук `event.id`; refund/payout — отдельные ключи. После 24 ч Stripe может принять ключ как новый: защищает ваш unique `psp_charge_id`.

Сверка ежедневная: PSP settlement / Balance Transactions vs леджер vs банк; инвойсы vs PaymentIntents vs вебхуки; usage sent vs billed; refunds и disputes — отдельные журналы; presentment vs settlement currency. Расхождение = инцидент, владелец, «деньги клиента > удобство отчёта». Не чинить руками в проде без тикета. Большинству SaaS хватает Postgres BIGINT и строгих воркеров; микросервис ledger ради резюме не нужен.

Тесты до запуска платящих: повторный POST не создаёт второй charge; `allocate(100,[1,1,1])` = 100; JPY 0 decimals, KWD 3; staging бьёт test-mode, не live «на 1 тенге».

Для любого масштаба: линтер/ревью запрета float в платёжных модулях. Для 100+: property-тесты денег в CI.

Когда «достаточно Excel»: никогда как источник правды. Сигнал ошибки: сумма трёх счетов не бьётся с инвойсом на копейку.

## 40.4. Налоги, инвойсы, отчётность и региональные требования

Налог считает ставка; юрист/tax определяет **что облагается**. «Включили Stripe Tax» ≠ compliant.

ЕС. ViDA вступила в силу 14 апреля 2025 (Council Directive (EU) 2025/516). Календарь: 01.01.2027 уточнения OSS/IOSS; 01.07.2028 deemed supplier для части платформ, SVR; 01.07.2030 обязательный DRR + e-invoicing на cross-border B2B. SaaS B2C: OSS, ставка страны потребителя; B2B reverse charge при валидном VAT ID. Инвойс — юридический документ: номер, дата, адрес, tax ID, нетто/VAT/брутто, язык/формат страны. Франция e-invoicing с 1 сентября 2026; Италия SdI, Испания SII, Польша KSeF (даты сверять). Implementing Regulation (EU) 2026/1869 (июль 2026) — техничка OSS/IOSS.

US. Economic nexus после *Wayfair* (2018) жив; пороги штатов часто $100k / 200 транзакций — **не универсально**. Taxability SaaS различается по штатам — в каталоге SKU, не в if-else чекаута. Stripe Sessions 2026: автоматизация US filing через TaxJar — расчёт и часть подачи, не квалификация товара.

KZ и «продаём из US LLC». Вопросы до рекламы: налоговый резидент и постоянное представительство; НДС РК на электронные услуги нерезидентам — не OSS ЕС; ЭСФ для местного ТОО; валютный контроль выплат продавцам маркетплейса. Ставки — только КГД/counsel на дату. Kaspi как эквайер не снимает закрывающие документы.

Инвойс воспроизводится из леджера, не только из UI. Кредитные ноты на refund. Архив часто 7–10 лет. Смена юрадреса/VAT — версия шаблона, не правка истории.

Пути: Stripe Tax (ломается на нестандартной taxability, facilitator, странах вне покрытия); Anrok/Avalara (цена, всё равно квалификация SKU); MoR/Paddle (комиссия, потеря чекаута; ломается на enterprise VAT ID); ERP+tax team (не начинать, пока нет команды).

Для 1–3: MoR или Stripe Tax + не продавать в штаты/страны вне покрытия без совета. Для 10–30: taxability SKU, OSS, инвойс-шаблон. Для 100+: tax engine + counsel, e-invoicing провайдер.

Когда не «разберёмся потом»: первая B2C продажа в ЕС уже включает OSS. Сигнал ошибки: в инвойсе нет VAT ID и ставки страны потребителя.

## 40.5. Отказы платежей, восстановление (dunning), непреднамеренный отток

Involuntary churn — платёжная операция. Recurly network (июль 2026), медианный **годовой** churn SaaS: **3,22%** = 2,16% voluntary + 1,06% involuntary. При ARPC $250+ involuntary **0,18%** vs 1,30% при $10–25: качество метода и то, что клиент чинит карту сам. Доля involuntary ~33% у Recurly SaaS согласуется с серединой кочующего «20–40%» из ProfitWell (⚠️ разные источники). Годовой 3% ≠ 0,25%×12: 2% месячный ≈ 22% годовой компаундингом. Путать горизонт — ошибка финмодели (Глава 7).

Слои ROI. (1) Account Updater — тихая замена PAN/expiry. (2) Smart Retries: дефолт Stripe 8 попыток / 2 недели; non-card часто не ретраится. (3) Pre-dunning до expiry. (4) 4–6 касаний тоном «обновить метод», magic link на портал; SMS/in-app если почту не открывают. (5) Политика по коду: expired → форма сразу; insufficient_funds → окно зарплаты; stolen → новый метод, не ретрай. (6) Backup method. (7) Pause, если экономика позволяет (Глава 37.6).

Вендорские «recovery 55–75% full stack» vs «22–35% только retries» — гипотеза для A/B, не KPI из книжки. Свой recovery = recovered MRR / failed invoice MRR за 30 дней, без survivor bias. Антипаттерн: четыре коллекторских письма за 7 дней — часть involuntary становится voluntary cancel.

Метрики отдельно: failure rate по методу и BIN; recovery по decline code; time-to-recover; MRR churn vs customer churn. Не путать с open rate писем.

Для 1–3: Updater + Smart Retries + одно письмо с ссылкой на портал. Для 10–30: код-специфичная политика, backup card. Для 100+: свой recovery dashboard, A/B тона.

Когда не «улучшать продукт»: карта истекла. Сигнал ошибки: одна цифра churn в дашборде PM.

## 40.6. Возвраты, споры, чарджбэки и защита от фрода

Refund инициируете вы. Dispute/chargeback — банк клиента: холд/списание + fee (у Stripe ориентир $15, при выигрыше часто возвращается, ⚠️ не прайс-лист). Выигранный диспут не всегда чистит VAMP-ratio. Сроки representment короткие (часто 7–21 день). Evidence: доставка/логин, IP/device, CVV/AVS, 3DS, переписка, ToS timestamp. Без 3DS fraud liability обычно на мерчанте.

Пороги сетей гниют быстро — сверять fact sheet эквайера. Digital Transactions (1 апреля 2026): Visa VAMP порог мерчанта 1,5% (ранее публиковались 2,2% с июня 2025). Mastercard ECM: 1,50% и ≥100 CB/мес; HECM 3,00% и ≥300. MATCH — бан на эквайринг на годы. Операционный потолок продукта: dispute rate **<0,5–0,65%**, не ждать письма банка.

Фрод 2026 у AI: кража токенов/кредитов, multi-account, PAYG «нажгли GPU». Классика CNP: stolen cards, triangulation, friendly fraud, card testing. Контроли: Radar/аналог на signup **и** charge, velocity, 3DS на риске, AVS, network tokens, лимиты testing-BIN, капча после N decline, поэтапная выдача кредитов, hold до usage. Не оставлять публичный PaymentIntent без ограничений суммы.

Friendly fraud: получил услугу, открыл диспут. Лечится дескриптором, историей списаний, письмом до renewal, evidence совпадения device с онбордингом. Fight, когда win-rate × (сумма − fee) > cost пакета. Для $9 часто refund+cancel; для $9k annual — fight при логах.

PCI: не логировать PAN/CVV в трейсы, Sentry, session replay, промпты LLM. Реджекс-редэкшн на границе. Magecart: PCI 6.4.3 и 11.6.1 после 31.03.2025 — инвентарь скриптов на платёжной странице, SRI/CSP, мониторинг изменений. Не ставить GTM на ту же страницу, что PAN, без оценки. Цель — SAQ A и вне CDE, не ROC.

Для 1–3: hosted checkout, Radar, дескриптор, не хранить CHD. Для 10–30: playbook диспута, velocity rules. Для 100+: Ethoca/CDRN, свои фичи фрода поверх Radar, VAMP-дашборд.

Когда не fight: мелкий friendly при отсутствии логов. Сигнал ошибки: CVV в БД «для рекуррента».

## 40.7. Выплаты и маркетплейс-схемы, escrow, KYC/AML

Модели. Direct charge — мерчант продавец, платформе сложнее take. Destination / separate charges & transfers — проще комиссия, ответственность за connected accounts. MoR/принципал — вы продавец, налог и чарджбэки на вас. Agent / marketplace facilitator — зависит от штата (sales tax laws).

Escrow: деньги недоступны продавцу до события (доставка, окно N дней) — холд/reserve на connected account, не «потом с расчётника CEO». Negative balance: чарджбэк после выплаты без rolling reserve = платформа платит сама. Моделировать worst-case seller fraud до масштаба онбординга.

Минимальная схема услуг: charge → окно → auto-release или confirm сторон → спор freeze + human (SLA в ToS) → после release rolling reserve 5–20% на 30–90 дней (калибр по категории, не копия %) → payout не daily для новых. Зрелость: из леджера видно in-flight, reserve, at-risk по открытым диспутам.

KYC/AML. Stripe Connect: hosted/embedded onboarding переживает смену полей; API-формы — ручное обновление. Явно в доке Stripe: не полагаться на их верификацию как на **свою** юридическую KYC. Источник правды: `account.updated`, `requirements.currently_due` / `future_requirements` / errors — не редирект. Апрель–май 2026: пакет FCA/CBI требований к UBO/directors (`individual` с 1 апреля, `company` с 1 мая 2026). Санкционные списки OFAC/EU/UK; SAR-паттерны (много аккаунтов, мгновенный вывод). Travel Rule — для VASP/крипто; маркетплейс с кошельками может им стать — не гадать, юрист MSB/EMI. Выплаты в KZ/ЕАЭС: ИИН/БИН, валютный контроль; Kaspi Pay для мерчантов — не Stripe Connect.

Для 1–3: не запускать двусторонний рынок «на Stripe Checkout». Для 10–30: Connect Express + hosted KYC + reserve. Для 100+: своя KYC-политика, мониторинг, лицензия если порог.

Когда не быть принципалом: не хотите чарджбэки продавцов на своём VAMP. Сигнал ошибки: выплаты daily с дня 1 без reserve.

## 40.8. Чек-лист платёжного контура перед запуском

**Архитектура и PCI**

- [ ] Hosted/Elements/токены; CHD не в ваших логах, БД, replay, промптах.
- [ ] SAQ A eligibility перечитана по гайдансу после 31.03.2025, не по блогу 2023.
- [ ] Скрипты платёжной страницы: инвентарь, CSP/SRI, нет лишнего GTM.
- [ ] Канон заказа у вас; вебхук: raw signature, дедуп, async, <5 с.
- [ ] Автомат authorized ≠ captured; Success URL не истина.
- [ ] Локальный метод целевого рынка в списке (iDEAL/Pix/UPI/Kaspi/…).
- [ ] План fallback: decline-коды разведены; dual-PSP или ручной инвойс при lockout.
- [ ] Network tokens / Account Updater включены, если доступны.

**Деньги и биллинг**

- [ ] Money-тип без float; тесты allocate и ISO exponent.
- [ ] Детерминированный Idempotency-Key; повтор POST безопасен.
- [ ] Суточная сверка PSP ↔ леджер ↔ доступ (оплатил/не получил и наоборот).
- [ ] Refund и dispute — отдельные проводки.
- [ ] Entitlements свои; hot path лимитов realtime; AI-кредит до инференса.
- [ ] Прорейт и даунгрейд зафиксированы; Price версионирован.
- [ ] Free/trial: cap, антифрод signup, себестоимость в модели Главы 7.

**Налог и документы**

- [ ] Tax engine + квалификация SKU; OSS/nexus по гео.
- [ ] Инвойс из леджера; кредитные ноты; архив.
- [ ] ToS: что продаёте, автопродление, отмена, смена цены, AUP, dispute до чарджбэка.

**Риск и маркетплейс**

- [ ] Dunning: Updater, retries, письма, политика по коду.
- [ ] Radar/velocity; дескриптор; playbook fight vs refund.
- [ ] Потолок dispute rate задан (<0,5–0,65%).
- [ ] Если маркетплейс: hosted KYC, reserve, escrow, мониторинг `requirements.*`, санкции.
- [ ] Секреты PSP не в git; staging ≠ live; ротация без простоя.
- [ ] Runbook lockout PSP и key-person на сверке (Глава 44).

Не прошёл чек-лист — не «включим оплату в пятницу». Это запуск контура, в котором ошибка = чужие деньги.

## Чек-лист главы

**Владение**

- [ ] Назван owner леджера, сверки, dunning-политики, диспутов — не «все немного».
- [ ] PSP dashboard не считается бухгалтерией.

**Масштаб**

- [ ] 1–3: hosted + один PSP + Tax/MoR + cap free.
- [ ] 10–30: локальные методы, кредитный леджер, сверка, Radar на signup.
- [ ] 100+: dual-PSP/токены, billing engine, VAMP-дашборд, KYC-политика.

**Связки**

- [ ] GM и cap AI-free согласованы с Главой 6–7.
- [ ] Involuntary отделён от продуктового оттока (37.6 / 40.5).
- [ ] T&S фрода мультиаккаунтов связан с 34.3.

## Антипаттерны

«Редирект как истина — UI „спасибо“, леджер пуст — проще интеграции — вебхук + сверка»

«Float-деньги — JS number, копейка уплыла — привычка — BIGINT minor + ISO 4217 (Fowler)»

«UUID на ретрай — двойной charge — „уникальность“ — детерминированный ключ от order_id»

«Один decline-политика — expired ретраят две недели — копипаст Smart Retries — код-специфичный путь»

«CVV в БД — „для рекуррента“ — прямой запрет PCI FAQ 1574 — токены, не SAD»

«Без локального метода — Stripe-карты в NL/KZ — глобальный SDK — iDEAL/Kaspi/Pix как first-class»

«Meters как AI-биллинг 2026 — нет max/avg, асинхронность, Stripe сам шлёт на Metronome — hot path свой, rating в Metronome/Orb»

«Налог потом — первая EU B2C без OSS — страх бюрократии — Tax/MoR до рекламы»

«Продуктовый редизайн при expired card — involuntary как UX — одна цифра churn — dunning 40.5»

«Выплаты без reserve — чарджбэк после payout, касса платформы — рост GMV — escrow + rolling reserve»

«MoR на enterprise — нет VAT ID клиента, кастомный контракт — удобство ранней стадии — свой мерчант + tax engine»

«Оркестратор ради слайда — два PSP, нулевой выигрыш auth, двойная сверка — страх lock-in без объёма — второй PSP по порогу 40.1»

## Что читать дальше

- Глава 6 — какую единицу тарифицировать; эта глава — как списать и не соврать в инвойсе.
- Глава 7 — сходится ли когорта после комиссий PSP, refunds и COGS инференса.
- Глава 17.7 — фоновая работа с деньгами на бэкенде: воркеры, идемпотентность сервиса.
- Глава 32 / 33 — PCI в SDLC и privacy; 40.8 не заменяет threat model.
- Глава 34.5 — финансовый фрод как T&S: чарджбэки, мультиаккаунт, AML-паттерны.
- Глава 44 — runway, vendor lockout, key-person на сверке; платёжный SPOF — риск компании.
