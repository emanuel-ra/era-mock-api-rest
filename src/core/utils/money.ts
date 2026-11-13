/** Rounds to cents so amounts like 0.1 + 0.2 don't carry floating point noise. */
export function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}
