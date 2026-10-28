import "server-only";

/**
 * Telegram channel publishing.
 *
 * This is the primary channel, not a secondary one. Threads has roughly 1.85M
 * users in Kazakhstan (~9% of the population) and its 2026 ranking penalises
 * frequency — 1–3 posts a day is the ceiling before reach dilutes. A Telegram
 * channel has no comparable cap and its audience opted in, so the full event
 * firehose belongs here while Threads gets only the best story of the day.
 *
 * Bot API, no dependency: one POST per message.
 */

const API = "https://api.telegram.org";

/** Telegram tolerates roughly one message per second per chat. */
export const MIN_INTERVAL_MS = 1200;

export type TelegramConfig = {
  botToken: string;
  chatId: string;
};

export function telegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

export type TelegramResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; retryable: boolean; retryAfterMs?: number };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Send one message to the channel.
 *
 * Text is escaped and sent as HTML so a brand name containing `<` or `&` cannot
 * break the message or inject markup — brand names are user-supplied.
 */
export async function sendChannelMessage(params: {
  config: TelegramConfig;
  text: string;
  linkUrl?: string | null;
}): Promise<TelegramResult> {
  const body: Record<string, unknown> = {
    chat_id: params.config.chatId,
    text: escapeHtml(params.text),
    parse_mode: "HTML",
    // A preview of our own link is the selling card; keep it small and below.
    link_preview_options: params.linkUrl
      ? { url: params.linkUrl, prefer_small_media: true, show_above_text: false }
      : { is_disabled: true },
  };

  let response: Response;
  try {
    response = await fetch(`${API}/bot${params.config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "network error",
      retryable: true,
    };
  }

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
    parameters?: { retry_after?: number };
  };

  if (!response.ok || !data.ok || !data.result?.message_id) {
    const retryAfter = data.parameters?.retry_after;
    return {
      ok: false,
      error: data.description ?? `HTTP ${response.status}`,
      // 429 carries retry_after; 5xx is transient. A 400 is our own bad payload.
      retryable: response.status === 429 || response.status >= 500,
      retryAfterMs: retryAfter ? retryAfter * 1000 : undefined,
    };
  }

  return { ok: true, messageId: String(data.result.message_id) };
}
