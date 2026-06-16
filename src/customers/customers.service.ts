import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { paginate, PaginatedResult } from '../core/dto/pagination.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { FilterCustomersDto } from './dto/filter-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerEntity } from './entities/customer.entity';
import { CustomersRepository } from './customers.repository';

@Injectable()
export class CustomersService {
  constructor(private readonly repo: CustomersRepository) {}

  findAll(filters: FilterCustomersDto): PaginatedResult<CustomerEntity> {
    const { page, limit, ...rest } = filters;
    return paginate(this.repo.findAll(rest), page, limit);
  }

  findOne(id: string): CustomerEntity {
    return this.repo.findByIdOrFail(id);
  }

  create(dto: CreateCustomerDto): CustomerEntity {
    if (this.repo.findByEmail(dto.email)) {
      throw new ConflictException(`Customer with email "${dto.email}" already exists`);
    }

    return this.repo.create({
      ...dto,
      phone: dto.phone ?? '',
      address: dto.address ?? '',
      city: dto.city ?? '',
      country: dto.country ?? '',
      company: dto.company ?? '',
      isActive: dto.isActive ?? true,
    });
  }

  update(id: string, dto: UpdateCustomerDto): CustomerEntity {
    if (dto.email) {
      const existingWithEmail = this.repo.findByEmail(dto.email);
      if (existingWithEmail && existingWithEmail.id !== id) {
        throw new ConflictException(`Customer with email "${dto.email}" already exists`);
      }
    }

    const updated = this.repo.update(id, dto);
    if (!updated) throw new NotFoundException(`Customer "${id}" not found`);
    return updated;
  }

  remove(id: string): void {
    if (!this.repo.delete(id)) throw new NotFoundException(`Customer "${id}" not found`);
  }
}
