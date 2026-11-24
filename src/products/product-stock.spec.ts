import { ProductStatus } from './entities/product.entity';
import { applyStockDelta } from './product-stock';

describe('applyStockDelta', () => {
  it('takes stock out and keeps an active product active while stock remains', () => {
    expect(applyStockDelta({ stock: 5, status: ProductStatus.Active }, -3)).toEqual({
      stock: 2,
      status: ProductStatus.Active,
    });
  });

  it('marks an active product out_of_stock when it reaches 0', () => {
    expect(applyStockDelta({ stock: 3, status: ProductStatus.Active }, -3)).toEqual({
      stock: 0,
      status: ProductStatus.OutOfStock,
    });
  });

  it('marks an out_of_stock product active when stock comes back', () => {
    expect(applyStockDelta({ stock: 0, status: ProductStatus.OutOfStock }, 2)).toEqual({
      stock: 2,
      status: ProductStatus.Active,
    });
  });

  it.each([
    [4, -4],
    [4, -1],
    [0, 3],
  ])('keeps an inactive product inactive (stock %i, delta %i)', (stock, delta) => {
    expect(applyStockDelta({ stock, status: ProductStatus.Inactive }, delta).status).toBe(
      ProductStatus.Inactive,
    );
  });
});
