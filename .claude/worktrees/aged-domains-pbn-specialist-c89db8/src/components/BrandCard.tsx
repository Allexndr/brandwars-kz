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
    <Link href={`/brand/${slug}`} className="surface-card group block transition hover:shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-soft)] text-lg font-bold text-primary">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-full w-full rounded-lg object-cover" />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-ink group-hover:text-primary">{name}</h3>
            {isVerified && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] uppercase text-emerald-700">
                ✓
              </span>
            )}
            {isLeader && (
              <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] text-primary">
                {getRankLabel(1, locale)}
              </span>
            )}
          </div>
          {categoryName && <p className="mt-0.5 text-xs text-muted">{categoryName}</p>}
          <div className="mt-2 flex gap-3 text-xs text-muted">
            {rank != null && <span>#{rank}</span>}
            {territoryShare != null && (
              <span>{Math.round(territoryShare * 100)}% территории</span>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-[10px] uppercase tracking-wide text-muted">
        Реклама · игровая метрика BrandWars
      </p>
    </Link>
  );
}
