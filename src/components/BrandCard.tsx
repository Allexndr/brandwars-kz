import { Link } from "@/i18n/routing";
import { getRankLabel } from "@/lib/territory";

type BrandCardProps = {
  slug: string;
  name: string;
  categoryName?: string;
  verificationStatus?: string;
  rank?: number;
  territoryShare?: number;
  locale?: string;
  logoUrl?: string | null;
};

export function BrandCard({
  slug,
  name,
  categoryName,
  verificationStatus,
  rank,
  territoryShare,
  locale = "ru",
  logoUrl,
}: BrandCardProps) {
  const isVerified = verificationStatus === "VERIFIED";
  const isLeader = rank === 1;

  return (
    <Link
      href={`/brand/${slug}`}
      className="group block rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-sky-700 hover:bg-slate-900"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-lg font-bold text-sky-400">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full rounded-lg object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-white group-hover:text-sky-300">
              {name}
            </h3>
            {isVerified && (
              <span className="rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] uppercase text-emerald-400">
                ✓
              </span>
            )}
            {isLeader && (
              <span className="rounded bg-amber-900/50 px-1.5 py-0.5 text-[10px] text-amber-300">
                {getRankLabel(1, locale)}
              </span>
            )}
          </div>
          {categoryName && (
            <p className="mt-0.5 text-xs text-slate-400">{categoryName}</p>
          )}
          <div className="mt-2 flex gap-3 text-xs text-slate-500">
            {rank != null && <span>#{rank}</span>}
            {territoryShare != null && (
              <span>{Math.round(territoryShare * 100)}% территории</span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-600">
        Реклама · игровая метрика BrandWars
      </p>
    </Link>
  );
}
