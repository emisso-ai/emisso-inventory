/**
 * ABC classification and cycle count scheduling.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for cycle count frequency. */
export type CycleCountConfig = {
  aFrequencyDays: number; // e.g., 30 (monthly)
  bFrequencyDays: number; // e.g., 90 (quarterly)
  cFrequencyDays: number; // e.g., 365 (annually)
};

// ---------------------------------------------------------------------------
// ABC Classification
// ---------------------------------------------------------------------------

/**
 * Classify materials into ABC categories based on annual value.
 *
 * - A = top 80% of cumulative value (typically ~20% of items)
 * - B = next 15% of cumulative value
 * - C = remaining 5% of cumulative value
 */
export function classifyABC(
  materials: Array<{ materialId: string; annualValue: number }>,
): Array<{
  materialId: string;
  abcClass: 'A' | 'B' | 'C';
  annualValue: number;
  cumulativePercentage: number;
}> {
  // Sort by value descending
  const sorted = [...materials].sort((a, b) => b.annualValue - a.annualValue);

  const totalValue = sorted.reduce((acc, m) => acc + m.annualValue, 0);
  if (totalValue === 0) {
    return sorted.map((m) => ({
      materialId: m.materialId,
      abcClass: 'C' as const,
      annualValue: m.annualValue,
      cumulativePercentage: 0,
    }));
  }

  let cumulativeValue = 0;

  return sorted.map((m) => {
    cumulativeValue += m.annualValue;
    const cumulativePercentage = (cumulativeValue / totalValue) * 100;

    let abcClass: 'A' | 'B' | 'C';
    if (cumulativePercentage <= 80) {
      abcClass = 'A';
    } else if (cumulativePercentage <= 95) {
      abcClass = 'B';
    } else {
      abcClass = 'C';
    }

    return {
      materialId: m.materialId,
      abcClass,
      annualValue: m.annualValue,
      cumulativePercentage,
    };
  });
}

// ---------------------------------------------------------------------------
// Cycle Count Schedule
// ---------------------------------------------------------------------------

/**
 * Generate a count schedule from classified materials.
 * Each material gets a next count date based on its ABC class frequency.
 */
export function generateCycleCountSchedule(
  materials: Array<{ materialId: string; abcClass: 'A' | 'B' | 'C' }>,
  config: CycleCountConfig,
  startDate: Date,
): Array<{
  materialId: string;
  abcClass: 'A' | 'B' | 'C';
  nextCountDate: Date;
  frequencyDays: number;
}> {
  const frequencyMap: Record<'A' | 'B' | 'C', number> = {
    A: config.aFrequencyDays,
    B: config.bFrequencyDays,
    C: config.cFrequencyDays,
  };

  return materials.map((m) => {
    const frequencyDays = frequencyMap[m.abcClass];
    const nextCountDate = new Date(startDate);
    nextCountDate.setDate(nextCountDate.getDate() + frequencyDays);

    return {
      materialId: m.materialId,
      abcClass: m.abcClass,
      nextCountDate,
      frequencyDays,
    };
  });
}
