import { ProductEntity, ProductStatus } from './entities/product.entity';
import { ProductsRepository } from './products.repository';

describe('ProductsRepository', () => {
  let repo: ProductsRepository;

  const product = (
    overrides: Partial<ProductEntity> = {},
  ): Omit<ProductEntity, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: 'Wireless Mouse',
    description: '',
    price: 29.99,
    sku: 'WM-001',
    stock: 10,
    category: 'Electronics',
    status: ProductStatus.Active,
    imageUrl: '',
    ...overrides,
  });

  beforeEach(() => {
    repo = new ProductsRepository();
  });

  it('finds a product by SKU ignoring case', () => {
    repo.create(product());

    expect(repo.findBySku('wm-001')?.name).toBe('Wireless Mouse');
    expect(repo.findBySku('OTHER')).toBeUndefined();
  });

  it('searches name by substring, and other fields exactly', () => {
    repo.create(product());

    expect(repo.findAll({ name: 'mouse' })).toHaveLength(1);
    expect(repo.findAll({ category: 'Elec' })).toHaveLength(0);
  });
});
