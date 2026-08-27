"use client";

import { useState } from "react";

export default function ReportPage() {
  const [reason, setReason] = useState("OTHER");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        description,
        brandId: brandId || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(JSON.stringify(data.error));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="surface-card text-center text-emerald-700">
        Спасибо, жалоба принята на рассмотрение.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">Пожаловаться</h1>
      <form onSubmit={submit} className="surface-card space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-field">
          <option value="FRAUD">Мошенничество</option>
          <option value="INAPPROPRIATE">Неподобающий контент</option>
          <option value="IMPERSONATION">Выдача за другой бренд</option>
          <option value="OTHER">Другое</option>
        </select>
        <input
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
          placeholder="ID бренда (опционально)"
          className="input-field"
        />
        <textarea
          required
          minLength={10}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Опишите проблему..."
          rows={5}
          className="input-field"
        />
        <button type="submit" className="btn-primary w-full">
          Отправить
        </button>
      </form>
    </div>
  );
}
