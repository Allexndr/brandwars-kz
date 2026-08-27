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
      <p className="rounded-lg border border-slate-800 bg-slate-900/40 p-6 text-center text-slate-400">
        Пока нет данных для рейтинга
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-slate-900 text-slate-400">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Бренд</th>
            <th className="px-4 py-3">Категория</th>
            <th className="px-4 py-3">Сила</th>
            <th className="px-4 py-3">Территория</th>
            <th className="px-4 py-3">Статус</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={`${entry.categorySlug}-${entry.brandSlug}`}
              className="border-t border-slate-800 hover:bg-slate-900/50"
            >
              <td className="px-4 py-3 font-mono text-sky-400">{entry.rank}</td>
              <td className="px-4 py-3 font-medium">{entry.brandName}</td>
              <td className="px-4 py-3 text-slate-400">{entry.categoryName}</td>
              <td className="px-4 py-3">{Math.round(entry.battlePower)}</td>
              <td className="px-4 py-3">
                {Math.round(entry.territoryShare * 100)}%
              </td>
              <td className="px-4 py-3 text-xs text-amber-300/80">
                {entry.rankLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
