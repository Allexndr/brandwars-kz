# Payments — Lemon Squeezy + overtake alerts

## Card / Google Pay / Apple Pay / PayPal

BrandWars uses **Lemon Squeezy hosted checkout** (same pattern as TopBrands).
Payment methods appear automatically on the Lemon page — no separate Google Pay SDK.

### Setup
1. Create a Lemon Squeezy store + **one-time** product (pay-what-you-want or fixed).
2. Copy Store ID + Variant ID + API key.
3. Env:

```bash
PAYMENT_PROVIDER=lemonsqueezy
PAYMENT_TEST_MODE=false
LEMONSQUEEZY_API_KEY=...
LEMONSQUEEZY_STORE_ID=...
LEMONSQUEEZY_VARIANT_ID=...
LEMONSQUEEZY_WEBHOOK_SECRET=...
```

4. Webhook in Lemon dashboard → `https://brand-wars.vercel.app/api/webhooks/payments`
   Events: `order_created`, `order_paid`.

5. Redeploy. Claim / dashboard «Оплатить» redirects to Lemon checkout with custom KZT amount.

Without Lemon keys, `PAYMENT_TEST_MODE=true` keeps the local test confirm flow.

## «Вас обошли» notifications

After territory recalculation, if a brand’s rank worsens:
- Email to claim contact
- Telegram (bot + optional `telegramChatId` on profile, or `TELEGRAM_NOTIFY_CHAT_ID`)

Message includes amount = rival power − my power + 1 and a **pay link**.

```bash
EMAIL_SERVER_HOST=...
EMAIL_SERVER_USER=...
EMAIL_SERVER_PASSWORD=...
EMAIL_FROM=noreply@brandwars.kz
TELEGRAM_BOT_TOKEN=...
TELEGRAM_NOTIFY_CHAT_ID=...   # fallback chat
```
