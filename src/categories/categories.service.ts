import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate, PaginatedResult } from '../core/dto/pagination.dto';
import { sortItems } from '../core/utils/sort';
import { slugify } from '../core/utils/slugify';
import { ProductsRepository } from '../products/products.repository';
import { CategoriesRepository } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { FilterCategoriesDto } from './dto/filter-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryEntity } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly repo: CategoriesRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  findAll(filters: FilterCategoriesDto): PaginatedResult<CategoryEntity> {
    const { page, limit, sortBy, order, ...rest } = filters;
    return paginate(sortItems(this.repo.findAll(rest), sortBy, order), page, limit);
  }

  findOne(id: string): CategoryEntity {
    return this.repo.findByIdOrFail(id);
  }

  create(dto: CreateCategoryDto): CategoryEntity {
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) {
      throw new BadRequestException(`Cannot generate a slug from "${dto.name}"; send a slug`);
    }
    this.assertNameIsFree(dto.name);
    this.assertSlugIsFree(slug);

    return this.repo.create({
      ...dto,
      slug,
      description: dto.description ?? '',
      isActive: dto.isActive ?? true,
    });
  }

  update(id: string, dto: UpdateCategoryDto): CategoryEntity {
    // The slug is not regenerated when the name changes, so existing links keep working.
    if (dto.name) this.assertNameIsFree(dto.name, id);
    if (dto.slug) this.assertSlugIsFree(dto.slug, id);

    const updated = this.repo.update(id, dto);
    if (!updated) throw new NotFoundException(`Category "${id}" not found`);
    return updated;
  }

  remove(id: string): void {
    this.repo.findByIdOrFail(id);

    // Deleting it would leave products pointing to a category that no longer exists.
    const inUse = this.productsRepo.countByCategory(id);
    if (inUse > 0) {
      throw new ConflictException(`Category "${id}" is used by ${inUse} product(s)`);
    }

    this.repo.delete(id);
  }

  private assertNameIsFree(name: string, currentId?: string): void {
    const existing = this.repo.findByName(name);
    if (existing && existing.id !== currentId) {
      throw new ConflictException(`Category with name "${name}" already exists`);
    }
  }

  private assertSlugIsFree(slug: string, currentId?: string): void {
    const existing = this.repo.findBySlug(slug);
    if (existing && existing.id !== currentId) {
      throw new ConflictException(`Category with slug "${slug}" already exists`);
    }
  }
}
