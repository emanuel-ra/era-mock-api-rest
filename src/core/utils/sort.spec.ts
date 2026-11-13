import { SortOrder, sortItems } from './sort';

interface Row {
  id: number;
  name?: string | null;
  price?: number;
  createdAt?: Date;
}

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('sortItems', () => {
  it('returns the same items when no field is given', () => {
    const rows: Row[] = [{ id: 2 }, { id: 1 }];
    expect(sortItems(rows)).toBe(rows);
  });

  it('does not mutate the input array', () => {
    const rows: Row[] = [
      { id: 1, price: 2 },
      { id: 2, price: 1 },
    ];
    sortItems(rows, 'price');
    expect(ids(rows)).toEqual([1, 2]);
  });

  it('sorts strings ignoring case, ascending by default', () => {
    const rows: Row[] = [
      { id: 1, name: 'banana' },
      { id: 2, name: 'Apple' },
      { id: 3, name: 'cherry' },
    ];
    expect(ids(sortItems(rows, 'name'))).toEqual([2, 1, 3]);
    expect(ids(sortItems(rows, 'name', SortOrder.Desc))).toEqual([3, 1, 2]);
  });

  it('sorts numbers by value, not as text', () => {
    const rows: Row[] = [
      { id: 1, price: 10 },
      { id: 2, price: 9 },
      { id: 3, price: 100 },
    ];
    expect(ids(sortItems(rows, 'price', SortOrder.Asc))).toEqual([2, 1, 3]);
    expect(ids(sortItems(rows, 'price', SortOrder.Desc))).toEqual([3, 1, 2]);
  });

  it('sorts dates chronologically', () => {
    const rows: Row[] = [
      { id: 1, createdAt: new Date('2024-02-01') },
      { id: 2, createdAt: new Date('2023-12-31') },
      { id: 3, createdAt: new Date('2024-01-15') },
    ];
    expect(ids(sortItems(rows, 'createdAt'))).toEqual([2, 3, 1]);
    expect(ids(sortItems(rows, 'createdAt', SortOrder.Desc))).toEqual([1, 3, 2]);
  });

  it('puts null, undefined and empty values last in both orders', () => {
    const rows: Row[] = [
      { id: 1 },
      { id: 2, name: 'b' },
      { id: 3, name: null },
      { id: 4, name: 'a' },
      { id: 5, name: '' },
    ];
    expect(ids(sortItems(rows, 'name'))).toEqual([4, 2, 1, 3, 5]);
    expect(ids(sortItems(rows, 'name', SortOrder.Desc))).toEqual([2, 4, 1, 3, 5]);
  });

  it('keeps the original order of ties', () => {
    const rows: Row[] = [
      { id: 1, price: 5 },
      { id: 2, price: 5 },
      { id: 3, price: 1 },
    ];
    expect(ids(sortItems(rows, 'price'))).toEqual([3, 1, 2]);
    expect(ids(sortItems(rows, 'price', SortOrder.Desc))).toEqual([1, 2, 3]);
  });
});
