import { setRequestLocale, getTranslations } from "next-intl/server";
import { BrandCard } from "@/components/BrandCard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function BrandsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q, category } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("brands");

  let brands: Array<{
    slug: string;
    name: string;
    verificationStatus: string;
    logoUrl: string | null;
    categoryName: string;
    rank?: number;
    territoryShare?: number;
  }> = [];

  try {
    const rows = await prisma.brand.findMany({
      where: {
        isActive: true,
        ...(category ? { primaryCategory: { slug: category } } : {}),
        ...(q
          ? { name: { contains: q, mode: "insensitive" } }
          : {}),
      },
      include: {
        primaryCategory: true,
        territories: { orderBy: { rank: "asc" }, take: 1 },
      },
      orderBy: { name: "asc" },
      take: 50,
    });
    brands = rows.map((b) => ({
      slug: b.slug,
      name: b.name,
      verificationStatus: b.verificationStatus,
      logoUrl: b.logoUrl,
      categoryName:
        locale === "kk" ? b.primaryCategory.nameKk : b.primaryCategory.nameRu,
      rank: b.territories[0]?.rank,
      territoryShare: b.territories[0]?.territoryShare,
    }));
  } catch {
    // empty
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold text-ink">{t("title")}</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Поиск..." className="input-field flex-1" />
        <button type="submit" className="btn-primary px-6">
          OK
        </button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((b) => (
          <BrandCard key={b.slug} {...b} locale={locale} />
        ))}
      </div>
      {brands.length === 0 && (
        <p className="text-center text-muted">Бренды не найдены</p>
      )}
    </div>
  );
}
