import { SLUG_PATTERN, slugify } from './slugify';

describe('slugify', () => {
  it.each([
    ['Electronics', 'electronics'],
    ['Home & Garden', 'home-garden'],
    ['  Sports   Gear  ', 'sports-gear'],
    ['Electrónica y Café', 'electronica-y-cafe'],
    ['4K TVs!', '4k-tvs'],
  ])('turns "%s" into "%s"', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing usable is left', () => {
    expect(slugify('&& !!')).toBe('');
  });

  it('always produces a slug that matches SLUG_PATTERN', () => {
    expect(slugify('Home & Garden')).toMatch(SLUG_PATTERN);
  });
});
