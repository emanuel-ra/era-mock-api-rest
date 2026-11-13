import { toCents } from './money';

describe('toCents', () => {
  it('rounds to two decimals', () => {
    expect(toCents(0.1 + 0.2)).toBe(0.3);
    expect(toCents(19.999)).toBe(20);
    expect(toCents(3 * 33.33)).toBe(99.99);
  });
});
