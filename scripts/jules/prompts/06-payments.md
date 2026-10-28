Add payment integration. Read docs/brandwars-kz-master-prd-and-spec.md section 19 and docs/research/sources/37_kazakhstan-payment-gateways-comparison.md.

Requirements:
- PaymentProvider interface: createOrder, verifyWebhook, getStatus
- Implement TestPaymentProvider when PAYMENT_TEST_MODE=true
- Implement CloudPayments KZ provider stub (real API shape, env-gated)
- Webhook route POST /api/webhooks/payments with idempotency key
- PaymentOrder statuses: pending, paid, failed, refunded, chargeback, disputed
- Battle Power updates ONLY after status=paid
- /dashboard — brand owner overview: position, territory, top-up form
- POST /api/dashboard/top-up — creates payment order, redirects or shows test confirm
- Admin: manual confirm button for test payments
- Refund rules text visible before payment (i18n stub OK)

Acceptance: test payment flow → webhook/manual confirm → territory recalculates.
