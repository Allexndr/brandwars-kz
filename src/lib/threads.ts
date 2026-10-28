import "server-only";

/**
 * Threads publishing over Meta's official API.
 *
 * Deliberately no third-party library: the flow is two HTTP calls, and every
 * popular community client is a reverse-engineered password-login wrapper.
 * The most cited one (junhoyeo/threads-api) was archived in September 2023
 * after Meta got in touch and warns it may breach Meta's terms — a banned
 * account would take the project's main hype channel with it.
 *
 * Posting to our own profile needs only the `threads_basic` and
 * `threads_content_publish` scopes; app review is required only for publishing
 * on behalf of other accounts, which we never do.
 */

const GRAPH = "https://graph.threads.net/v1.0";

/** Meta's documented publishing cap, per profile. */
export const DAILY_POST_LIMIT = 250;
/** Meta recommends waiting before publishing a freshly created container. */
export const CONTAINER_SETTLE_MS = 30_000;

export type ThreadsConfig = {
  userId: string;
  accessToken: string;
};

export function threadsConfig(): ThreadsConfig | null {
  const userId = process.env.THREADS_USER_ID;
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  if (!userId || !accessToken) return null;
  return { userId, accessToken };
}

export type PublishResult =
  | { ok: true; postId: string }
  | { ok: false; error: string; retryable: boolean };

async function graphPost(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status: number }> {
  const body = new URLSearchParams({ ...params, access_token: accessToken });

  const response = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: { id?: string; error?: { message?: string } } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    // Fall through to the raw body below.
  }

  if (!response.ok || !parsed.id) {
    return {
      ok: false,
      status: response.status,
      error: parsed.error?.message ?? text.slice(0, 300),
    };
  }

  return { ok: true, id: parsed.id };
}

/**
 * Create the container, let it settle, publish it.
 *
 * `settleMs` is injectable so the cron can publish containers created on an
 * earlier tick instead of holding a function open for 30 seconds.
 */
export async function publishTextPost(params: {
  config: ThreadsConfig;
  text: string;
  linkUrl?: string | null;
  settleMs?: number;
}): Promise<PublishResult> {
  const { config } = params;

  const container = await graphPost(
    `${config.userId}/threads`,
    {
      media_type: "TEXT",
      text: params.text,
      ...(params.linkUrl ? { link_attachment: params.linkUrl } : {}),
    },
    config.accessToken,
  );

  if (!container.ok) {
    return {
      ok: false,
      error: `container: ${container.error}`,
      // 4xx is our fault (bad copy, bad scope); 5xx and 429 are worth retrying.
      retryable: container.status >= 500 || container.status === 429,
    };
  }

  const settle = params.settleMs ?? CONTAINER_SETTLE_MS;
  if (settle > 0) {
    await new Promise((resolve) => setTimeout(resolve, settle));
  }

  const published = await graphPost(
    `${config.userId}/threads_publish`,
    { creation_id: container.id },
    config.accessToken,
  );

  if (!published.ok) {
    return {
      ok: false,
      error: `publish: ${published.error}`,
      retryable: published.status >= 500 || published.status === 429,
    };
  }

  return { ok: true, postId: published.id };
}

/**
 * Long-lived tokens expire in 60 days. Refresh well before that, or the bot
 * goes quiet at the worst possible moment.
 */
export async function refreshLongLivedToken(
  accessToken: string,
): Promise<{ ok: true; accessToken: string; expiresIn: number } | { ok: false; error: string }> {
  const url = new URL(`${GRAPH}/refresh_access_token`);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!response.ok || !data.access_token) {
    return { ok: false, error: data.error?.message ?? "refresh failed" };
  }

  return {
    ok: true,
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 0,
  };
}
