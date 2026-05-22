/**
 * MAP-EDITOR-ARCH-01 PR5 — Mapgen config / presets foundation.
 *
 * Typed configuration model for procedural map generation.
 * Allows future presets ("more resources", "fewer obstacles") without
 * touching gameplay systems, UI, or core constants.
 *
 * Design decisions:
 * - All fields are counts or density divisors — no structural radii,
 *   placement distances, or attempt limits (those stay hardcoded).
 * - `Partial<MapgenConfig>` is the caller-facing type so callers only
 *   override what they need; `resolveMapgenConfig()` fills defaults.
 * - `DEFAULT_MAPGEN_CONFIG` matches the pre-PR5 hardcoded values exactly,
 *   so `generateMap()` without config produces identical output.
 * - No volcano-specific fields.  Volcano types/code remain unchanged.
 */

/** Tunable map generation parameters.  Counts and density divisors only. */
export interface MapgenConfig {
  // ── Resources — starter pocket ─────────────────────────────────────
  /** Number of small resource deposits in the starter pocket near HQ. */
  starterSmallCount: number;
  /** Number of medium resource deposits in the starter pocket near HQ. */
  starterMediumCount: number;

  // ── Resources — transition zone ────────────────────────────────────
  /** Medium resources placed in the transition annulus. */
  transitionMediumCount: number;
  /** Large resources placed in the transition annulus. */
  transitionLargeCount: number;

  // ── Resources — far zone ───────────────────────────────────────────
  /** Large resources placed in the far zone (beyond transition). */
  farLargeCount: number;

  // ── Resources — center field ───────────────────────────────────────
  /** Whether to place the center mineral_infinite deposit. */
  centerInfiniteEnabled: boolean;
  /** Large resources surrounding the center infinite deposit. */
  centerLargeCount: number;
  /** Medium resources surrounding the center infinite deposit. */
  centerMediumCount: number;

  // ── Obstacles — edge biome ─────────────────────────────────────────
  /** Edge obstacle clusters on standard-size maps. */
  edgeClusterCountStandard: number;
  /** Edge obstacle clusters on large-size maps. */
  edgeClusterCountLarge: number;

  // ── Obstacles — interior ───────────────────────────────────────────
  /** Divisor for interior cluster count: count = w*h / divisor.
   *  Lower value = more clusters.  Default 400. */
  interiorClusterDensityDivisor: number;

  // ── Decor ──────────────────────────────────────────────────────────
  /** Bush decor items scattered across the map. */
  decorBushCount: number;
  /** Sand-bump decor items scattered across the map. */
  decorSandBumpCount: number;
  /** Additional bush decor biased toward map edges. */
  edgeDecorBushCount: number;
  /** Additional sand-bump decor biased toward map edges. */
  edgeDecorSandBumpCount: number;
}

/** Default "balanced" preset — matches pre-PR5 hardcoded values exactly. */
export const DEFAULT_MAPGEN_CONFIG: Readonly<MapgenConfig> = {
  // Resources — starter pocket
  starterSmallCount: 10,
  starterMediumCount: 5,

  // Resources — transition zone
  transitionMediumCount: 3,
  transitionLargeCount: 2,

  // Resources — far zone
  farLargeCount: 2,

  // Resources — center field
  centerInfiniteEnabled: true,
  centerLargeCount: 4,
  centerMediumCount: 5,

  // Obstacles — edge biome
  edgeClusterCountStandard: 8,
  edgeClusterCountLarge: 14,

  // Obstacles — interior
  interiorClusterDensityDivisor: 400,

  // Decor
  decorBushCount: 18,
  decorSandBumpCount: 22,
  edgeDecorBushCount: 6,
  edgeDecorSandBumpCount: 8,
};

/** Alias for readability when more presets are added later. */
export const BALANCED_PRESET: Readonly<MapgenConfig> = DEFAULT_MAPGEN_CONFIG;

/**
 * Merge a partial caller override with the default balanced config.
 *
 * @param config - Override fields.  Omit or pass `{}` for full defaults.
 * @returns A complete `MapgenConfig` with all fields filled.
 */
export function resolveMapgenConfig(config?: Partial<MapgenConfig>): MapgenConfig {
  if (!config) return { ...DEFAULT_MAPGEN_CONFIG };
  return { ...DEFAULT_MAPGEN_CONFIG, ...config };
}
