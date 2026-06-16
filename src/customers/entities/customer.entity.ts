import { BaseEntity } from '../../core/entities/base.entity';

export class CustomerEntity extends BaseEntity {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  company: string;
  isActive: boolean;
}
