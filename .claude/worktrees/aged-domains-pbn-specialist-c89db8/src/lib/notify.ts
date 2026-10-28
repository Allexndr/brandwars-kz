import nodemailer from "nodemailer";

type NotifyPayload = {
  toEmail?: string | null;
  telegramChatId?: string | null;
  subject: string;
  text: string;
  html?: string;
};

export async function sendEmailNotify(payload: NotifyPayload): Promise<boolean> {
  if (!payload.toEmail) return false;

  const host = process.env.EMAIL_SERVER_HOST;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM ?? "noreply@brandwars.kz";

  if (!host || !user || !pass) {
    console.info("[notify:email:dry-run]", payload.toEmail, payload.subject);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    secure: false,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: payload.toEmail,
    subject: payload.subject,
    text: payload.text,
    html: payload.html ?? `<pre>${payload.text}</pre>`,
  });
  return true;
}

export async function sendTelegramNotify(
  chatId: string | null | undefined,
  text: string,
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const fallback = process.env.TELEGRAM_NOTIFY_CHAT_ID;
  const target = chatId || fallback;
  if (!token || !target) {
    console.info("[notify:telegram:dry-run]", text.slice(0, 120));
    return false;
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: target,
      text,
      disable_web_page_preview: false,
    }),
  });
  return res.ok;
}

export async function notifyChannels(payload: NotifyPayload): Promise<void> {
  await Promise.allSettled([
    sendEmailNotify(payload),
    sendTelegramNotify(payload.telegramChatId, payload.text),
  ]);
}
