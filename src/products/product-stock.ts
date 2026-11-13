import { ProductEntity, ProductStatus } from './entities/product.entity';

/**
 * Returns the product's stock after adding `delta` (negative to take stock out),
 * and the status that goes with it: an `active` product that reaches 0 becomes
 * `out_of_stock`, and an `out_of_stock` product that gets stock back becomes `active`.
 * `inactive` products keep their status.
 */
export function applyStockDelta(
  product: Pick<ProductEntity, 'stock' | 'status'>,
  delta: number,
): Pick<ProductEntity, 'stock' | 'status'> {
  const stock = product.stock + delta;
  let status = product.status;
  if (stock <= 0 && status === ProductStatus.Active) status = ProductStatus.OutOfStock;
  if (stock > 0 && status === ProductStatus.OutOfStock) status = ProductStatus.Active;
  return { stock, status };
}
