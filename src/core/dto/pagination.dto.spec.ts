import { paginate } from './pagination.dto';

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns the requested page and its metadata', () => {
    const result = paginate(items, 2, 10);

    expect(result.data).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(result.meta).toEqual({ total: 25, page: 2, limit: 10, totalPages: 3 });
  });

  it('returns a partial last page', () => {
    expect(paginate(items, 3, 10).data).toEqual([21, 22, 23, 24, 25]);
  });

  it('returns an empty page past the end', () => {
    const result = paginate(items, 5, 10);

    expect(result.data).toEqual([]);
    expect(result.meta.total).toBe(25);
  });

  it('handles an empty list', () => {
    expect(paginate([], 1, 10)).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  });
});
