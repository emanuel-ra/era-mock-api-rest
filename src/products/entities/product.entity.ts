import { BaseEntity } from '../../core/entities/base.entity';

export enum ProductStatus {
  Active = 'active',
  Inactive = 'inactive',
  OutOfStock = 'out_of_stock',
}

export class ProductEntity extends BaseEntity {
  name: string;
  description: string;
  price: number;
  sku: string;
  stock: number;
  category: string;
  status: ProductStatus;
  imageUrl: string;
}
