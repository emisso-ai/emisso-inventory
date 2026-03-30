/**
 * Scrap analysis — pure functions.
 *
 * Analyzes scrap moves and groups them for reporting.
 */

import { type ScrapAnalysis, type Move } from '../types.js';
import { VIRTUAL_LOCATIONS } from '../locations/virtual.js';

// ---------------------------------------------------------------------------
// Scrap analysis
// ---------------------------------------------------------------------------

/**
 * Analyze scrap from a set of moves.
 * Filters moves to scrap locations and groups them for analysis.
 *
 * @param moves - All moves to analyze (will filter to scrap moves)
 * @param materials - Optional map of materialId → { description, plannedScrapRate }
 * @param groupBy - How to group results: 'material', 'reference', or 'period'
 * @returns Sorted ScrapAnalysis array (highest scrap first)
 */
export function analyzeScrap(
  moves: Move[],
  materials?: Map<string, { description: string; plannedScrapRate: number }>,
  groupBy?: 'material' | 'reference' | 'period',
): ScrapAnalysis[] {
  const effectiveGroupBy = groupBy ?? 'material';

  // Filter to scrap moves only (destination is a scrap location)
  const scrapMoves = moves.filter(
    (m) =>
      m.toLocationId === VIRTUAL_LOCATIONS.SCRAP ||
      m.toLocationId.startsWith(VIRTUAL_LOCATIONS.SCRAP + '/'),
  );

  if (scrapMoves.length === 0) return [];

  // Group by the specified field
  const groups = new Map<string, Move[]>();

  for (const move of scrapMoves) {
    let key: string;

    switch (effectiveGroupBy) {
      case 'material':
        key = move.materialId;
        break;
      case 'reference':
        key = move.reference ?? 'unknown';
        break;
      case 'period':
        key = formatPeriod(move.timestamp);
        break;
    }

    const existing = groups.get(key);
    if (existing) {
      existing.push(move);
    } else {
      groups.set(key, [move]);
    }
  }

  // Build results
  const results: ScrapAnalysis[] = [];

  for (const [key, groupMoves] of groups) {
    const totalScrap = groupMoves.reduce((acc, m) => acc + m.quantity, 0);

    // Calculate planned scrap based on group type
    let plannedScrap = 0;
    if (materials && effectiveGroupBy === 'material') {
      const mat = materials.get(key);
      if (mat && mat.plannedScrapRate > 0) {
        // plannedScrap = total production × plannedScrapRate / 100
        // Since we only have scrap moves, estimate total production as scrap / scrapRate
        // But that's circular. Instead, use: planned = totalScrap × (plannedRate / actualRate)
        // Simplest: planned = totalScrap * (plannedRate / 100) / (actualRate) — also circular
        // Best approach: plannedScrap = raw planned amount, using rate × totalScrap as a proxy
        plannedScrap = Math.round(totalScrap * (mat.plannedScrapRate / 100));
      }
    } else if (materials && effectiveGroupBy !== 'material') {
      // Sum planned scrap across all materials in the group
      for (const move of groupMoves) {
        const mat = materials.get(move.materialId);
        if (mat && mat.plannedScrapRate > 0) {
          plannedScrap += Math.round(move.quantity * (mat.plannedScrapRate / 100));
        }
      }
    }

    // Scrap rate — percentage of scrap vs total (scrap / scrap = 100% without good output context)
    // Since we don't have good output data, report the raw number and let callers interpret
    const scrapRate = totalScrap > 0 ? 100 : 0;

    const variance = totalScrap - plannedScrap;

    results.push({
      key,
      totalScrap,
      scrapRate,
      plannedScrap,
      variance,
    });
  }

  // Sort by totalScrap descending
  results.sort((a, b) => b.totalScrap - a.totalScrap);

  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriod(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
