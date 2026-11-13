import { BaseEntity } from '../../core/entities/base.entity';

export class CategoryEntity extends BaseEntity {
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
}
