"use client";

import { useCallback, useEffect, useState } from "react";

type SocialInboxPost = {
  dedupeKey: string;
  kind: string;
  kindLabel: string;
  text: string;
  linkUrl: string | null;
  priority: number;
  threadsPick: boolean;
  createdAt: string;
  postedAt: string | null;
  ids: string[];
  channels: string[];
};

type InboxResponse = {
  mode: "auto" | "manual";
  posts: SocialInboxPost[];
};

function fullPostText(post: SocialInboxPost): string {
  return post.linkUrl ? `${post.text}\n\n${post.linkUrl}` : post.text;
}

export default function AdminSocialPage() {
  const [tab, setTab] = useState<"queued" | "posted">("queued");
  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/social?status=${tab === "posted" ? "posted" : "queued"}`);
      const json = (await res.json()) as InboxResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Ошибка загрузки");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function collect() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collect" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось собрать");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function copy(post: SocialInboxPost) {
    await navigator.clipboard.writeText(fullPostText(post));
    setCopiedKey(post.dedupeKey);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  async function markPosted(dedupeKey: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_posted", dedupeKey }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось отметить");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">
          Посты для соцсетей
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Без Meta API: система собирает сюжеты с карты, ты копируешь текст и
          публикуешь в Threads или Telegram вручную. Крон по-прежнему собирает
          новые посты раз в сутки.
        </p>
        {data?.mode === "manual" ? (
          <p className="mt-2 text-xs text-[var(--color-accent)]">
            Режим: ручная публикация (SOCIAL_PUBLISH_MODE не задан или manual)
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Режим: auto — API-каналы тоже включены (SOCIAL_PUBLISH_MODE=auto)
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("queued")}
          className={`rounded-brand px-3 py-1.5 text-sm font-medium ${
            tab === "queued" ? "bg-ink text-white" : "border border-[var(--color-border)] text-muted"
          }`}
        >
          Очередь
        </button>
        <button
          type="button"
          onClick={() => setTab("posted")}
          className={`rounded-brand px-3 py-1.5 text-sm font-medium ${
            tab === "posted" ? "bg-ink text-white" : "border border-[var(--color-border)] text-muted"
          }`}
        >
          Опубликовано
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={collect}
          className="btn-primary ml-auto disabled:opacity-50"
        >
          {busy ? "…" : "Собрать новые сюжеты"}
        </button>
      </div>

      {error ? (
        <p className="rounded-brand bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <p className="text-muted">Загрузка…</p>
      ) : !data?.posts.length ? (
        <p className="text-muted">
          {tab === "queued"
            ? "Очередь пуста. Нажми «Собрать новые сюжеты» или дождись крона."
            : "Пока ничего не отмечено как опубликованное."}
        </p>
      ) : (
        <ul className="space-y-4">
          {data.posts.map((post) => (
            <li key={post.dedupeKey} className="surface-card space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--color-surface-soft)] px-2 py-0.5 text-xs font-medium text-ink">
                  {post.kindLabel}
                </span>
                <span className="text-xs text-muted">приоритет {post.priority}</span>
                {post.threadsPick ? (
                  <span className="text-xs font-medium text-[var(--color-accent)]">
                    топ для Threads
                  </span>
                ) : null}
                <span className="text-xs text-muted">
                  {new Date(post.createdAt).toLocaleString("ru-KZ")}
                </span>
              </div>

              <pre className="whitespace-pre-wrap rounded-brand border border-[var(--color-border)] bg-white p-3 font-sans text-sm text-ink">
                {fullPostText(post)}
              </pre>

              {tab === "queued" ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copy(post)}
                    className="rounded-brand border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-ink hover:border-ink"
                  >
                    {copiedKey === post.dedupeKey ? "Скопировано" : "Скопировать"}
                  </button>
                  <a
                    href="https://www.threads.net/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-brand border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-ink hover:border-ink"
                  >
                    Открыть Threads
                  </a>
                  {post.linkUrl ? (
                    <a
                      href={post.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-brand border border-[var(--color-border)] bg-white px-3 py-1.5 text-sm font-medium text-ink hover:border-ink"
                    >
                      Ссылка в посте
                    </a>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => markPosted(post.dedupeKey)}
                    className="rounded-brand bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Опубликовал вручную
                  </button>
                </div>
              ) : post.postedAt ? (
                <p className="text-xs text-muted">
                  Отмечено: {new Date(post.postedAt).toLocaleString("ru-KZ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
