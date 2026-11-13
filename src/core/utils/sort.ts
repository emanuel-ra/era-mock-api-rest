export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function compareValues(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

/**
 * Returns a sorted copy of `items` by `field`. Strings compare case-insensitively
 * (localeCompare), numbers and dates by value. Items without a value (`null`,
 * `undefined` or `''`, e.g. a customer with no city) always go last, in both
 * orders. The sort is stable, so ties keep their original order. Without
 * `field` the items are returned as they are.
 */
export function sortItems<T>(items: T[], field?: keyof T, order: SortOrder = SortOrder.Asc): T[] {
  if (!field) return items;
  const direction = order === SortOrder.Desc ? -1 : 1;

  return [...items].sort((a, b) => {
    const va = a[field];
    const vb = b[field];
    const aMissing = isMissing(va);
    const bMissing = isMissing(vb);
    if (aMissing || bMissing) return Number(aMissing) - Number(bMissing);
    return compareValues(va, vb) * direction;
  });
}
