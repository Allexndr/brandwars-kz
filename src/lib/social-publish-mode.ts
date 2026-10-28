import "server-only";

/** `auto` — Telegram/Threads API. `manual` (default) — только очередь в админке. */
export function socialPublishMode(): "auto" | "manual" {
  const raw = process.env.SOCIAL_PUBLISH_MODE?.trim().toLowerCase();
  return raw === "auto" ? "auto" : "manual";
}

export function isSocialAutoPublishEnabled(): boolean {
  return socialPublishMode() === "auto";
}
