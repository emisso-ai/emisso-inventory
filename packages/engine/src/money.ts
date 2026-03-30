/**
 * Money utilities for inventory valuation
 *
 * All monetary values are stored as integers (cents).
 * No floating point for money — all operations round to integer.
 */

/**
 * Round a number to the nearest integer.
 */
export function round(value: number): number {
  return Math.round(value);
}

/**
 * Multiply two numbers and round to integer.
 */
export function multiply(a: number, b: number): number {
  return round(a * b);
}

/**
 * Divide two numbers and round to integer.
 * @throws Error if divisor is zero
 */
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return round(a / b);
}

/**
 * Calculate a percentage of an amount and round to integer.
 * @param amount - Base amount in integer cents
 * @param rate - Percentage rate (e.g., 10.5 for 10.5%)
 * @returns Calculated percentage as integer
 */
export function percentage(amount: number, rate: number): number {
  return round((amount * rate) / 100);
}

/**
 * Sum any number of values, rounding each before adding.
 */
export function sum(...values: number[]): number {
  return values.reduce((acc, val) => acc + round(val), 0);
}

/**
 * Compute a weighted average and round to integer.
 * Useful for AVCO (average cost) recalculation.
 *
 * @param items - Array of { value, weight } pairs
 * @returns Weighted average as integer, or 0 if total weight is zero
 */
export function weightedAverage(items: Array<{ value: number; weight: number }>): number {
  const totalWeight = items.reduce((acc, item) => acc + item.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = items.reduce((acc, item) => acc + item.value * item.weight, 0);
  return round(weightedSum / totalWeight);
}
