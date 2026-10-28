/**
 * A contiguous hex lattice on a sphere, and region growth over it.
 *
 * The previous globe scattered cells along spiral arms with random jitter, so a
 * continent read as a spray of dots with holes in it — there was no land, only
 * markers. Here every cell has real neighbours, continents grow outward from
 * seeds until they meet, and brand territories are grown the same way inside a
 * continent. That produces actual landmasses with actual borders: no gaps, and
 * a brand's holdings are one connected shape rather than confetti.
 *
 * Pure functions, no canvas — the renderer just draws what this returns.
 */

export type LatticeCell = {
  index: number;
  lat: number;
  lon: number;
  row: number;
  col: number;
  /** Approximate angular radius, so cells tile without visible seams. */
  size: number;
};

export type Lattice = {
  cells: LatticeCell[];
  /** Adjacency: six-ish neighbours per cell. */
  neighbors: number[][];
  rows: number;
};

/** Poles are left empty — cells there are tiny and read as noise. */
const MAX_LAT = 1.24;

export function buildLattice(rows = 30, equatorCols = 46): Lattice {
  const cells: LatticeCell[] = [];
  const rowRanges: { start: number; count: number; lat: number }[] = [];

  for (let row = 0; row < rows; row++) {
    const t = rows === 1 ? 0.5 : row / (rows - 1);
    const lat = -MAX_LAT + t * (MAX_LAT * 2);
    // Column count follows cos(lat) so cells stay near-equal-area.
    const count = Math.max(6, Math.round(equatorCols * Math.cos(lat)));
    const start = cells.length;

    for (let col = 0; col < count; col++) {
      // Offset every other row by half a cell: that is what makes the packing
      // hexagonal rather than a square grid.
      const offset = row % 2 === 0 ? 0 : 0.5;
      const lon = ((col + offset) / count) * Math.PI * 2;
      cells.push({
        index: cells.length,
        lat,
        lon,
        row,
        col,
        size: (Math.PI * 2) / count / 2,
      });
    }

    rowRanges.push({ start, count, lat });
  }

  const neighbors: number[][] = cells.map(() => []);

  const columnAt = (row: number, lon: number): number => {
    const range = rowRanges[row];
    const offset = row % 2 === 0 ? 0 : 0.5;
    const raw = (lon / (Math.PI * 2)) * range.count - offset;
    return ((Math.round(raw) % range.count) + range.count) % range.count;
  };

  for (const cell of cells) {
    const range = rowRanges[cell.row];
    const list = neighbors[cell.index];

    // East and west wrap around the globe, so there is no seam.
    list.push(range.start + ((cell.col + 1) % range.count));
    list.push(range.start + ((cell.col - 1 + range.count) % range.count));

    // Two neighbours in each adjacent row, picked by longitude proximity.
    for (const dRow of [-1, 1]) {
      const row = cell.row + dRow;
      if (row < 0 || row >= rows) continue;
      const other = rowRanges[row];
      const centerCol = columnAt(row, cell.lon);
      list.push(other.start + centerCol);
      list.push(other.start + ((centerCol + 1) % other.count));
    }
  }

  return { cells, neighbors, rows };
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RegionResult = {
  /** Cell index -> region index, or -1 for ocean. */
  owner: Int32Array;
  /** Cells belonging to each region, in growth order. */
  members: number[][];
};

/**
 * Multi-source flood fill: every region grows one ring at a time from its seed
 * until it hits its quota or runs out of room.
 *
 * Growing all regions simultaneously is what makes borders fall where the
 * regions actually meet, instead of being drawn arbitrarily.
 */
export function growRegions(
  lattice: Lattice,
  seeds: number[],
  quotas: number[],
  options: { seed?: number; coastRoughness?: number } = {},
): RegionResult {
  const owner = new Int32Array(lattice.cells.length).fill(-1);
  const members: number[][] = seeds.map(() => []);
  const frontier: number[][] = seeds.map(() => []);
  const random = mulberry(options.seed ?? 1);
  const roughness = options.coastRoughness ?? 0;

  seeds.forEach((seedCell, region) => {
    if (seedCell < 0 || seedCell >= owner.length) return;
    if (owner[seedCell] !== -1) return;
    owner[seedCell] = region;
    members[region].push(seedCell);
    frontier[region].push(seedCell);
  });

  let growing = true;
  while (growing) {
    growing = false;

    for (let region = 0; region < seeds.length; region++) {
      if (members[region].length >= quotas[region]) continue;
      const queue = frontier[region];
      if (queue.length === 0) continue;

      // One ring per pass, so no region races ahead of its rivals.
      const ring = queue.splice(0, queue.length);
      const nextRing: number[] = [];

      for (const cellIndex of ring) {
        for (const neighbor of lattice.neighbors[cellIndex]) {
          if (owner[neighbor] !== -1) continue;
          if (members[region].length >= quotas[region]) break;
          // Occasionally refuse a cell so coastlines come out ragged instead of
          // perfectly circular.
          if (roughness > 0 && random() < roughness) {
            nextRing.push(cellIndex);
            continue;
          }
          owner[neighbor] = region;
          members[region].push(neighbor);
          nextRing.push(neighbor);
          growing = true;
        }
      }

      frontier[region] = nextRing;
    }
  }

  return { owner, members };
}

/** Evenly spread seed points, so continents do not clump on one hemisphere. */
export function fibonacciSeeds(lattice: Lattice, count: number): number[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const seeds: number[] = [];
  const used = new Set<number>();

  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const lat = Math.asin(Math.max(-1, Math.min(1, y * 0.82)));
    const lon = ((i * golden) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

    let best = 0;
    let bestDistance = Infinity;
    for (const cell of lattice.cells) {
      if (used.has(cell.index)) continue;
      const dLat = cell.lat - lat;
      let dLon = cell.lon - lon;
      if (dLon > Math.PI) dLon -= Math.PI * 2;
      if (dLon < -Math.PI) dLon += Math.PI * 2;
      const distance = dLat * dLat + dLon * dLon * Math.cos(lat) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = cell.index;
      }
    }

    used.add(best);
    seeds.push(best);
  }

  return seeds;
}

/**
 * Pick brand seeds inside a continent, spread as far apart as possible.
 *
 * Farthest-point selection keeps the leader's capital and its rivals from
 * sharing a border on turn one, which makes the internal map readable.
 */
export function spreadSeeds(
  lattice: Lattice,
  pool: number[],
  count: number,
): number[] {
  if (count <= 0 || pool.length === 0) return [];
  if (count >= pool.length) return pool.slice(0, count);

  const chosen: number[] = [pool[0]];

  while (chosen.length < count) {
    let best = pool[0];
    let bestScore = -Infinity;

    for (const candidate of pool) {
      if (chosen.includes(candidate)) continue;
      const cell = lattice.cells[candidate];
      let nearest = Infinity;
      for (const picked of chosen) {
        const other = lattice.cells[picked];
        const dLat = cell.lat - other.lat;
        let dLon = cell.lon - other.lon;
        if (dLon > Math.PI) dLon -= Math.PI * 2;
        if (dLon < -Math.PI) dLon += Math.PI * 2;
        const distance = dLat * dLat + dLon * dLon;
        if (distance < nearest) nearest = distance;
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = candidate;
      }
    }

    chosen.push(best);
  }

  return chosen;
}

export type PlanetTerritory = {
  cellIndex: number;
  lat: number;
  lon: number;
  size: number;
  continentIndex: number;
  /** -1 means unclaimed land inside the continent. */
  brandIndex: number;
  /** True when at least one neighbour belongs to someone else. */
  isBorder: boolean;
  /** True when at least one neighbour is ocean. */
  isCoast: boolean;
  shade: number;
};

/**
 * Full planet layout: continents grown from seeds, then brand territories grown
 * inside each continent.
 */
export function buildPlanet(params: {
  continentCount: number;
  /** Desired cell count per brand, per continent. */
  brandWeights: number[][];
  rows?: number;
  equatorCols?: number;
  /** Land share of the sphere, 0..1. */
  landFraction?: number;
  seed?: number;
}): { lattice: Lattice; territories: PlanetTerritory[] } {
  const lattice = buildLattice(params.rows ?? 30, params.equatorCols ?? 46);
  const total = lattice.cells.length;
  const landFraction = params.landFraction ?? 0.62;

  const continentSeeds = fibonacciSeeds(lattice, params.continentCount);
  const landBudget = Math.floor((total * landFraction) / Math.max(1, params.continentCount));

  const continents = growRegions(
    lattice,
    continentSeeds,
    continentSeeds.map(() => landBudget),
    { seed: params.seed ?? 7, coastRoughness: 0.16 },
  );

  const territories: PlanetTerritory[] = [];
  const brandOwner = new Int32Array(total).fill(-1);

  continents.members.forEach((pool, continentIndex) => {
    const weights = params.brandWeights[continentIndex] ?? [];
    if (weights.length === 0 || pool.length === 0) return;

    const seeds = spreadSeeds(lattice, pool, Math.min(weights.length, pool.length));
    const poolSet = new Set(pool);

    // Scale requested cells to the land actually available.
    const requested = weights.reduce((sum, w) => sum + Math.max(1, w), 0);
    const scale = requested > 0 ? Math.min(1, pool.length / requested) : 1;
    const quotas = weights.map((w) => Math.max(1, Math.round(Math.max(1, w) * scale)));

    // Grow only within this continent by masking everything else as taken.
    const localOwner = new Int32Array(total).fill(-2);
    for (const cellIndex of pool) localOwner[cellIndex] = -1;

    const members: number[][] = seeds.map(() => []);
    const frontier: number[][] = seeds.map(() => []);

    seeds.forEach((seedCell, brandIndex) => {
      localOwner[seedCell] = brandIndex;
      members[brandIndex].push(seedCell);
      frontier[brandIndex].push(seedCell);
    });

    let growing = true;
    while (growing) {
      growing = false;
      for (let brandIndex = 0; brandIndex < seeds.length; brandIndex++) {
        if (members[brandIndex].length >= quotas[brandIndex]) continue;
        const ring = frontier[brandIndex].splice(0, frontier[brandIndex].length);
        if (ring.length === 0) continue;
        const nextRing: number[] = [];

        for (const cellIndex of ring) {
          for (const neighbor of lattice.neighbors[cellIndex]) {
            if (!poolSet.has(neighbor)) continue;
            if (localOwner[neighbor] !== -1) continue;
            if (members[brandIndex].length >= quotas[brandIndex]) break;
            localOwner[neighbor] = brandIndex;
            members[brandIndex].push(neighbor);
            nextRing.push(neighbor);
            growing = true;
          }
        }

        frontier[brandIndex] = nextRing;
      }
    }

    for (const cellIndex of pool) {
      brandOwner[cellIndex] = localOwner[cellIndex] >= 0 ? localOwner[cellIndex] : -1;
    }
  });

  const random = mulberry((params.seed ?? 7) * 977);

  for (const cell of lattice.cells) {
    const continentIndex = continents.owner[cell.index];
    if (continentIndex < 0) continue;

    let isBorder = false;
    let isCoast = false;
    const brandIndex = brandOwner[cell.index];

    for (const neighbor of lattice.neighbors[cell.index]) {
      if (continents.owner[neighbor] < 0) {
        isCoast = true;
        continue;
      }
      if (
        continents.owner[neighbor] !== continentIndex ||
        brandOwner[neighbor] !== brandIndex
      ) {
        isBorder = true;
      }
    }

    territories.push({
      cellIndex: cell.index,
      lat: cell.lat,
      lon: cell.lon,
      size: cell.size,
      continentIndex,
      brandIndex,
      isBorder,
      isCoast,
      shade: 0.9 + random() * 0.2,
    });
  }

  return { lattice, territories };
}
