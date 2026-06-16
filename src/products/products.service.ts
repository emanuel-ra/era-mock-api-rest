import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { paginate, PaginatedResult } from '../core/dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductEntity, ProductStatus } from './entities/product.entity';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private readonly repo: ProductsRepository) {}

  findAll(filters: FilterProductsDto): PaginatedResult<ProductEntity> {
    const { page, limit, ...rest } = filters;
    return paginate(this.repo.findAll(rest), page, limit);
  }

  findOne(id: string): ProductEntity {
    return this.repo.findByIdOrFail(id);
  }

  create(dto: CreateProductDto): ProductEntity {
    if (dto.sku && this.repo.findBySku(dto.sku)) {
      throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
    }

    return this.repo.create({
      ...dto,
      description: dto.description ?? '',
      sku: dto.sku ?? '',
      stock: dto.stock ?? 0,
      category: dto.category ?? 'Uncategorized',
      status: dto.status ?? ProductStatus.Active,
      imageUrl: dto.imageUrl ?? '',
    });
  }

  update(id: string, dto: UpdateProductDto): ProductEntity {
    if (dto.sku) {
      const existingWithSku = this.repo.findBySku(dto.sku);
      if (existingWithSku && existingWithSku.id !== id) {
        throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
      }
    }

    const updated = this.repo.update(id, dto);
    if (!updated) throw new NotFoundException(`Product "${id}" not found`);
    return updated;
  }

  remove(id: string): void {
    if (!this.repo.delete(id)) throw new NotFoundException(`Product "${id}" not found`);
  }
}
