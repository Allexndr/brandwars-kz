/**
 * End-to-end check of the four mechanics against a real database.
 * Run: npx tsx <this file>
 */
import { PrismaClient } from "@prisma/client";
import { ensureScopes, ensureArena, claimCell, runDecayTick, arenaStandings, expandFrontierIfNeeded, openReadyCityScopes, payUpkeep } from "@/lib/arena";
import { openContest, addContestBid, resolveContest } from "@/lib/contest";
import { applyPaidLandOrder, purchaseLand } from "@/lib/land-purchase";
import { recalculateCategory } from "@/lib/territory";
import { generateCellPlan, cellPriceKzt, alignToPrimeTime, contestWinner, minChallengeKzt } from "@/lib/land";

const prisma = new PrismaClient();

// This script wipes the database. Refuse to run anywhere that is not local.
const dbUrl = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  console.error(
    "Refusing to run: DATABASE_URL is not local. This script deletes all data.",
  );
  process.exit(1);
}

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}`, detail ?? "");
  }
}

async function main() {
  console.log("\n=== 0. PURE FUNCTIONS ===");
  const plan = generateCellPlan(2, 4);
  check("radius 4 grid has 61 cells", plan.length === 61, plan.length);
  check("exactly one capital", plan.filter((c) => c.layer === "CAPITAL").length === 1);
  check("core ring count = 18", plan.filter((c) => c.layer === "CORE").length === 18, plan.filter((c) => c.layer === "CORE").length);
  check("price gradient: ring1 > ring2 > ring3",
    cellPriceKzt(1, 2) > cellPriceKzt(2, 2) && cellPriceKzt(2, 2) > cellPriceKzt(3, 2),
    [cellPriceKzt(1, 2), cellPriceKzt(2, 2), cellPriceKzt(3, 2)]);
  check("capital not purchasable", cellPriceKzt(0, 2) === 0);
  check("ties go to defender", contestWinner(5000, 5000) === "DEFENDER");
  check("challenger must strictly exceed", contestWinner(5001, 5000) === "CHALLENGER");
  const prime = alignToPrimeTime(new Date("2026-08-27T10:00:00Z"));
  check("prime time aligns to 15:00 UTC", prime.getUTCHours() === 15, prime.toISOString());
  check("min challenge respects invested", minChallengeKzt(500, 10000) === 5000, minChallengeKzt(500, 10000));

  console.log("\n=== SETUP ===");
  // Clean slate for the test category
  await prisma.$transaction([
    prisma.cellEvent.deleteMany({}),
    prisma.contestBid.deleteMany({}),
    prisma.contest.deleteMany({}),
    prisma.cell.deleteMany({}),
    prisma.arena.deleteMany({}),
    prisma.territory.deleteMany({}),
    prisma.transaction.deleteMany({}),
    prisma.walletTransaction.deleteMany({}),
    prisma.wallet.deleteMany({}),
    prisma.brandClaim.deleteMany({}),
    prisma.paymentOrder.deleteMany({}),
    prisma.brand.deleteMany({}),
    prisma.seasonCategory.deleteMany({}),
    prisma.scope.deleteMany({}),
    prisma.season.deleteMany({}),
    prisma.category.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  const season = await prisma.season.create({
    data: { slug: "s1", nameRu: "Сезон 1", nameKk: "Маусым 1", status: "ACTIVE", startsAt: new Date(), endsAt: new Date(Date.now() + 30 * 86400000) },
  });
  const category = await prisma.category.create({
    data: { slug: "travel", nameRu: "Путешествия", nameKk: "Саяхат", continentRu: "Травелия", continentKk: "Травелия", color: "#38BDF8" },
  });
  const seasonCategory = await prisma.seasonCategory.create({
    data: { seasonId: season.id, categoryId: category.id, entryMinimumKzt: 1000, priceCoefficient: 500 },
  });
  await ensureScopes();
  const kz = await prisma.scope.findUniqueOrThrow({ where: { slug: "kz" } });
  const arenaId = await ensureArena(seasonCategory.id, kz.id);

  const userA = await prisma.user.create({ data: { email: "a@test.kz" } });
  const userB = await prisma.user.create({ data: { email: "b@test.kz" } });
  const brandA = await prisma.brand.create({ data: { slug: "aviata", name: "Aviata", normalizedName: "aviata", primaryCategoryId: category.id, ownerUserId: userA.id, verificationStatus: "VERIFIED" } });
  const brandB = await prisma.brand.create({ data: { slug: "chocotravel", name: "Chocotravel", normalizedName: "chocotravel", primaryCategoryId: category.id, ownerUserId: userB.id, verificationStatus: "VERIFIED" } });
  await prisma.territory.createMany({ data: [
    { seasonCategoryId: seasonCategory.id, brandId: brandA.id },
    { seasonCategoryId: seasonCategory.id, brandId: brandB.id },
  ]});

  const cellCount = await prisma.cell.count({ where: { arenaId } });
  check("arena grid persisted (61 cells)", cellCount === 61, cellCount);

  console.log("\n=== 1. CELLS: absolute ownership, visible purchase ===");
  const target = await prisma.cell.findFirstOrThrow({ where: { arenaId, ring: 1 } });
  const claim1 = await claimCell({ arenaId, q: target.q, r: target.r, brandId: brandA.id, userId: userA.id, amountKzt: target.priceKzt });
  check("brand A claims a core cell", claim1.ok === true, claim1);

  const claim2 = await claimCell({ arenaId, q: target.q, r: target.r, brandId: brandB.id, userId: userB.id, amountKzt: target.priceKzt });
  check("second claim on same cell is rejected (race guard)", claim2.ok === false && claim2.reason === "occupied", claim2);

  const capital = await prisma.cell.findFirstOrThrow({ where: { arenaId, layer: "CAPITAL" } });
  const claimCap = await claimCell({ arenaId, q: capital.q, r: capital.r, brandId: brandB.id, userId: userB.id, amountKzt: 99999 });
  check("capital cannot be claimed", claimCap.ok === false && claimCap.reason === "capital", claimCap);

  // B takes 3 frontier cells
  const frontier = await prisma.cell.findMany({ where: { arenaId, layer: "FRONTIER", state: "NEUTRAL" }, take: 3 });
  for (const cell of frontier) {
    await claimCell({ arenaId, q: cell.q, r: cell.r, brandId: brandB.id, userId: userB.id, amountKzt: cell.priceKzt });
  }
  const standings1 = await arenaStandings(arenaId);
  check("B leads on land (3 cells vs 1)", standings1[0].brandId === brandB.id && standings1[0].cellCount === 3, standings1);

  await recalculateCategory(seasonCategory.id);
  const terrA = await prisma.territory.findFirstOrThrow({ where: { seasonCategoryId: seasonCategory.id, brandId: brandA.id } });
  const terrB = await prisma.territory.findFirstOrThrow({ where: { seasonCategoryId: seasonCategory.id, brandId: brandB.id } });
  check("territoryShare derived from cells, not money", terrB.territoryShare > terrA.territoryShare, { a: terrA.territoryShare, b: terrB.territoryShare });
  check("cellCount persisted on territory", terrB.cellCount === 3 && terrA.cellCount === 1, { a: terrA.cellCount, b: terrB.cellCount });
  check("rank 1 goes to more land", terrB.rank === 1 && terrA.rank === 2, { a: terrA.rank, b: terrB.rank });

  console.log("\n=== 2. CONTEST WINDOW: both sides pay ===");
  const contestedCell = await prisma.cell.findUniqueOrThrow({ where: { id: claim1.ok ? claim1.cellId : "" } });
  const open = await openContest({ cellId: contestedCell.id, challengerBrandId: brandB.id, userId: userB.id, amountKzt: 4800 });
  check("B opens a siege on A's cell", open.ok === true, open);

  const cellDuring = await prisma.cell.findUniqueOrThrow({ where: { id: contestedCell.id } });
  check("cell marked CONTESTED", cellDuring.state === "CONTESTED", cellDuring.state);

  const selfOpen = await openContest({ cellId: contestedCell.id, challengerBrandId: brandA.id, userId: userA.id, amountKzt: 1000 });
  check("owner joining own siege routes to DEFENDER side", selfOpen.ok === true, selfOpen);

  const contestId = open.ok ? open.contestId : "";
  await addContestBid({ contestId, brandId: brandA.id, userId: userA.id, amountKzt: 4200 });
  const midContest = await prisma.contest.findUniqueOrThrow({ where: { id: contestId } });
  check("defender total accumulates (1000 + 4200)", midContest.defenderKzt === 5200, midContest.defenderKzt);
  check("challenger total accumulates", midContest.challengerKzt === 4800, midContest.challengerKzt);

  const earlyResolve = await resolveContest(contestId);
  check("cannot resolve before close", earlyResolve.ok === false && earlyResolve.reason === "still_open", earlyResolve);

  const resolved = await resolveContest(contestId, { force: true });
  check("defender holds (5200 > 4800)", resolved.ok === true && resolved.winner === "DEFENDER", resolved);

  const cellAfter = await prisma.cell.findUniqueOrThrow({ where: { id: contestedCell.id } });
  check("cell returns to HELD by original owner", cellAfter.state === "HELD" && cellAfter.ownerBrandId === brandA.id, { state: cellAfter.state, owner: cellAfter.ownerBrandId });

  const walletB = await prisma.wallet.findUnique({ where: { userId: userB.id } });
  const walletA = await prisma.wallet.findUnique({ where: { userId: userA.id } });
  check("loser's stake refunded as wallet credit (challenger B: 4800)", walletB?.balance === 4800, walletB?.balance);
  check("winner's stake is NOT refunded (defender A)", (walletA?.balance ?? 0) === 0, walletA?.balance);

  const doubleResolve = await resolveContest(contestId, { force: true });
  check("resolving twice is rejected", doubleResolve.ok === false && doubleResolve.reason === "already_resolved", doubleResolve);

  console.log("\n=== 3. DECAY: recurring revenue engine ===");
  const longAgo = new Date(Date.now() - 40 * 86400000);
  await prisma.cell.updateMany({ where: { ownerBrandId: brandB.id, state: "HELD" }, data: { lastUpkeepAt: longAgo } });
  const decay1 = await runDecayTick();
  check("stale cells start fading", decay1.startedFading === 3, decay1);

  const fadingCount = await prisma.cell.count({ where: { arenaId, state: "FADING" } });
  check("cells are FADING, not yet lost", fadingCount === 3, fadingCount);

  // Owner returns inside grace window
  const fadingCell = await prisma.cell.findFirstOrThrow({ where: { arenaId, state: "FADING" } });
  const revived = await payUpkeep({ cellId: fadingCell.id, brandId: brandB.id, amountKzt: 500 });
  check("upkeep revives a fading cell", revived === true);
  const revivedCell = await prisma.cell.findUniqueOrThrow({ where: { id: fadingCell.id } });
  check("revived cell is HELD again", revivedCell.state === "HELD" && revivedCell.fadingSince === null, revivedCell.state);

  // Push the rest past grace
  await prisma.cell.updateMany({ where: { state: "FADING" }, data: { fadingSince: new Date(Date.now() - 10 * 86400000) } });
  const decay2 = await runDecayTick();
  check("cells past grace are released", decay2.released === 2, decay2);
  const released = await prisma.cell.findFirst({ where: { arenaId, state: "NEUTRAL", ring: { gt: 2 } } });
  check("released cell has no owner and zero invested", released !== null && released.ownerBrandId === null && released.investedKzt === 0, released);

  console.log("\n=== 4. NESTED SCOPES ===");
  const world = await prisma.scope.findUniqueOrThrow({ where: { slug: "world" } });
  check("world scope exists and is open", world.isOpen === true);
  check("world has no arena (derived, not sold twice)", (await prisma.arena.count({ where: { scopeId: world.id } })) === 0);
  const cities = await prisma.scope.count({ where: { kind: "CITY" } });
  check("city scopes seeded", cities === 15, cities);
  const openCities = await prisma.scope.count({ where: { kind: "CITY", isOpen: true } });
  check("cities start closed (no empty SEO pages)", openCities === 0, openCities);

  const opened = await openReadyCityScopes();
  check("cities stay closed below brand threshold", opened.length === 0, opened);

  console.log("\n=== 5. FRONTIER EXPANSION ===");
  const beforeRadius = (await prisma.arena.findUniqueOrThrow({ where: { id: arenaId } })).frontierRadius;
  // Fill the arena past the 85% threshold
  const empties = await prisma.cell.findMany({ where: { arenaId, state: "NEUTRAL", layer: { not: "CAPITAL" } } });
  await prisma.cell.updateMany({
    where: { id: { in: empties.slice(0, Math.ceil(empties.length * 0.95)).map((c) => c.id) } },
    data: { state: "HELD", ownerBrandId: brandA.id, lastUpkeepAt: new Date() },
  });
  const didExpand = await expandFrontierIfNeeded(arenaId);
  const afterRadius = (await prisma.arena.findUniqueOrThrow({ where: { id: arenaId } })).frontierRadius;
  check("frontier expands when nearly full", didExpand === true && afterRadius === beforeRadius + 1, { beforeRadius, afterRadius });
  const newTotal = await prisma.cell.count({ where: { arenaId } });
  check("new ring adds cells (61 -> 91)", newTotal === 91, newTotal);
  const coreUnchanged = await prisma.cell.count({ where: { arenaId, layer: "CORE" } });
  check("core stays finite through expansion", coreUnchanged === 18, coreUnchanged);

  console.log("\n=== 6. PAYMENT ATOMICITY AND IDEMPOTENCY ===");
  await prisma.wallet.create({ data: { userId: userA.id, balance: 2000 } });
  const walletTarget = await prisma.cell.findFirstOrThrow({
    where: { arenaId, state: "NEUTRAL", layer: "FRONTIER" },
  });
  const walletPurchase = await purchaseLand({
    intent: {
      kind: "cell_claim",
      arenaId,
      q: walletTarget.q,
      r: walletTarget.r,
      brandId: brandA.id,
    },
    userId: userA.id,
    amountKzt: walletTarget.priceKzt,
    seasonCategoryId: seasonCategory.id,
  });
  const walletAfter = await prisma.wallet.findUniqueOrThrow({ where: { userId: userA.id } });
  check("wallet claim applies atomically", walletPurchase.status === "applied");
  check("wallet is debited exactly once", walletAfter.balance === 1500, walletAfter.balance);

  const cardTarget = await prisma.cell.findFirstOrThrow({
    where: { arenaId, state: "NEUTRAL", layer: "FRONTIER" },
  });
  const paidOrder = await prisma.paymentOrder.create({
    data: {
      userId: userB.id,
      brandId: brandB.id,
      amountKzt: cardTarget.priceKzt,
      status: "PAID",
      paymentProvider: "test",
      providerOrderId: "paid-land-test",
      idempotencyKey: "paid-land-test",
      metadata: {
        landIntent: {
          kind: "cell_claim",
          arenaId,
          q: cardTarget.q,
          r: cardTarget.r,
          brandId: brandB.id,
        },
        seasonCategoryId: seasonCategory.id,
      },
    },
  });
  await applyPaidLandOrder(paidOrder.id);
  await applyPaidLandOrder(paidOrder.id);
  const [paidCell, paidTransactions, fulfilledOrder] = await Promise.all([
    prisma.cell.findUniqueOrThrow({ where: { id: cardTarget.id } }),
    prisma.transaction.count({ where: { paymentOrderId: paidOrder.id } }),
    prisma.paymentOrder.findUniqueOrThrow({ where: { id: paidOrder.id } }),
  ]);
  check("confirmed payment becomes land", paidCell.ownerBrandId === brandB.id);
  check("repeated fulfillment creates one transaction", paidTransactions === 1, paidTransactions);
  check("fulfilled order records appliedAt", fulfilledOrder.appliedAt !== null);

  console.log("\n=== 7. CHRONICLE ===");
  const events = await prisma.cellEvent.groupBy({ by: ["type"], _count: { _all: true } });
  const types = Object.fromEntries(events.map((e) => [e.type, e._count._all]));
  check("events recorded for claims", (types.CLAIMED ?? 0) >= 4, types);
  check("events recorded for contest", (types.CONTEST_OPENED ?? 0) >= 1 && (types.CONTEST_HELD ?? 0) >= 1, types);
  check("events recorded for decay", (types.FADING_STARTED ?? 0) >= 1 && (types.RELEASED ?? 0) >= 1, types);
  check("event recorded for frontier growth", (types.FRONTIER_EXPANDED ?? 0) === 1, types);

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  await prisma.$disconnect();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
