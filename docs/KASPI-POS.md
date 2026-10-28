# Kaspi через kaspi-pos-automation (self-hosted)

PayProverka — платный посредник поверх того же Kaspi Pay API.  
Этот гайд подключает [tapter-dev/kaspi-pos-automation](https://github.com/tapter-dev/kaspi-pos-automation) напрямую: счёт на телефон покупателя, вебхуки, polling статуса.

> Нужен **отдельный сервер** (VPS, Railway, Fly.io). На Vercel этот сервис не запустится — он должен работать 24/7.

---

## 1. Поднять kaspi-pos-automation

```bash
git clone https://github.com/tapter-dev/kaspi-pos-automation.git
cd kaspi-pos-automation
npm install
echo "TOKEN_SECRET_KEY=$(openssl rand -hex 32)" > .env
npm start
```

Сервер слушает порт `3000` (или `PORT` из env).

---

## 2. Авторизация (один раз)

Через демо UI `http://YOUR_SERVER:3000` или API:

1. `POST /api/auth/init` → `processId`
2. `POST /api/auth/send-phone` — номер **кассира Kaspi Pay** (ИП/ТОО)
3. `POST /api/auth/verify-otp` — SMS-код

Сохрани из ответа:

- `tokenSN` → `KASPI_POS_TOKEN_SN`
- `vtokenSecret` → `KASPI_POS_VTOKEN_SECRET`
- `profileId` → `KASPI_POS_PROFILE_ID` (если есть)

Сессия живёт ограниченное время; при 401 — перелогинься и обнови env.

---

## 3. Вебхуки → BrandWars

```bash
cp webhooks.example.json webhooks.json
```

```json
[
  {
    "url": "https://brand-wars.vercel.app/api/webhooks/kaspi-pos",
    "events": ["payment.success", "payment.failed", "payment.expired"],
    "secret": "СГЕНЕРИРУЙ_СЛУЧАЙНУЮ_СТРОКУ"
  }
]
```

Тот же `secret` → `KASPI_POS_WEBHOOK_SECRET` в Vercel.

---

## 4. Переменные в Vercel (Production)

| Переменная | Пример |
|------------|--------|
| `KASPI_POS_URL` | `https://kaspi-pos.yourdomain.com` |
| `KASPI_POS_TOKEN_SN` | из шага 2 |
| `KASPI_POS_VTOKEN_SECRET` | из шага 2 |
| `KASPI_POS_PROFILE_ID` | опционально |
| `KASPI_POS_WEBHOOK_SECRET` | как в webhooks.json |

`PAYPROVERKA_API_KEY` можно **не задавать** — при наличии `KASPI_POS_*` используется self-hosted.

Redeploy BrandWars.

---

## 5. Проверка

```bash
# health kaspi-pos
curl https://kaspi-pos.yourdomain.com/health

# тестовый заказ с сайта: выбрать Kaspi, указать +7
```

Внутренний probe (нужен `FOUNDERS_SEED_SECRET`):

```bash
curl -X POST "https://brand-wars.vercel.app/api/internal/kaspi-probe" \
  -H "Authorization: Bearer $FOUNDERS_SEED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"phone":"77051112240","amountKzt":1000}'
```

---

## Приоритет бэкендов Kaspi

1. **KASPI_POS_*** (self-hosted)  
2. `PAYMENT_BROKER_*` (SoulMetrica)  
3. `PAYPROVERKA_API_KEY` (PayProverka SaaS)

---

## Риски

- Эмуляция клиента Kaspi Pay — те же риски, что у PayProverka/посредников.
- Обновления приложения Kaspi могут потребовать обновить `kaspi-pos-automation`.
- Держите сервер и секреты только у себя, не в публичных репозиториях.
