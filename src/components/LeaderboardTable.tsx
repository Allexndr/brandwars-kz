type LeaderboardEntry = {
  brandSlug: string;
  brandName: string;
  categorySlug: string;
  categoryName: string;
  rank: number;
  rankLabel: string;
  battlePower: number;
  territoryShare: number;
};

type LeaderboardTableProps = {
  entries: LeaderboardEntry[];
  locale?: string;
};

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <p className="surface-card text-center text-muted">Пока нет данных для рейтинга</p>
    );
  }

  return (
    <div className="surface-card overflow-x-auto p-0">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-[var(--color-surface-soft)] text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">#</th>
            <th className="px-4 py-3 font-medium">Бренд</th>
            <th className="px-4 py-3 font-medium">Категория</th>
            <th className="px-4 py-3 font-medium">Сила</th>
            <th className="px-4 py-3 font-medium">Территория</th>
            <th className="px-4 py-3 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={`${entry.categorySlug}-${entry.brandSlug}`}
              className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-soft)]"
            >
              <td className="px-4 py-3 font-mono text-primary">{entry.rank}</td>
              <td className="px-4 py-3 font-medium text-ink">{entry.brandName}</td>
              <td className="px-4 py-3 text-muted">{entry.categoryName}</td>
              <td className="px-4 py-3">{Math.round(entry.battlePower)}</td>
              <td className="px-4 py-3">{Math.round(entry.territoryShare * 100)}%</td>
              <td className="px-4 py-3 text-xs text-primary">{entry.rankLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
