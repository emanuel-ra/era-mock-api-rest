import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginate, PaginatedResult } from '../core/dto/pagination.dto';
import { toCents } from '../core/utils/money';
import { CustomersRepository } from '../customers/customers.repository';
import { ProductsRepository } from '../products/products.repository';
import { CreateOrderDto, OrderItemDto } from './dto/create-order.dto';
import { FilterOrdersDto } from './dto/filter-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  ORDER_STATUS_TRANSITIONS,
  OrderEntity,
  OrderItem,
  OrderStatus,
} from './entities/order.entity';
import { OrdersRepository } from './orders.repository';

@Injectable()
export class OrdersService {
  constructor(
    private readonly repo: OrdersRepository,
    private readonly customersRepo: CustomersRepository,
    private readonly productsRepo: ProductsRepository,
  ) {}

  findAll(filters: FilterOrdersDto): PaginatedResult<OrderEntity> {
    const { page, limit, ...rest } = filters;
    return paginate(this.repo.findAll(rest), page, limit);
  }

  findOne(id: string): OrderEntity {
    return this.repo.findByIdOrFail(id);
  }

  create(dto: CreateOrderDto): OrderEntity {
    this.assertCustomerExists(dto.customerId);
    const items = this.buildItems(dto.items);

    return this.repo.create({
      customerId: dto.customerId,
      items,
      total: this.sumTotal(items),
      status: OrderStatus.Pending,
      notes: dto.notes ?? '',
    });
  }

  update(id: string, dto: UpdateOrderDto): OrderEntity {
    const order = this.repo.findById(id);
    if (!order) throw new NotFoundException(`Order "${id}" not found`);
    if (order.status !== OrderStatus.Pending) {
      throw new ConflictException(`Order "${id}" is ${order.status}; only pending orders can be edited`);
    }

    if (dto.customerId) this.assertCustomerExists(dto.customerId);

    const changes: Partial<OrderEntity> = {};
    if (dto.customerId !== undefined) changes.customerId = dto.customerId;
    if (dto.notes !== undefined) changes.notes = dto.notes;
    if (dto.items !== undefined) {
      // Replacing the items takes the current product names and prices.
      changes.items = this.buildItems(dto.items);
      changes.total = this.sumTotal(changes.items);
    }

    return this.repo.update(id, changes)!;
  }

  updateStatus(id: string, dto: UpdateOrderStatusDto): OrderEntity {
    const order = this.repo.findById(id);
    if (!order) throw new NotFoundException(`Order "${id}" not found`);

    if (!ORDER_STATUS_TRANSITIONS[order.status].includes(dto.status)) {
      throw new ConflictException(`Cannot change order status from ${order.status} to ${dto.status}`);
    }

    return this.repo.update(id, { status: dto.status })!;
  }

  remove(id: string): void {
    if (!this.repo.delete(id)) throw new NotFoundException(`Order "${id}" not found`);
  }

  private assertCustomerExists(customerId: string): void {
    if (!this.customersRepo.findById(customerId)) {
      throw new BadRequestException(`Customer "${customerId}" does not exist`);
    }
  }

  private buildItems(items: OrderItemDto[]): OrderItem[] {
    return items.map(({ productId, quantity }) => {
      const product = this.productsRepo.findById(productId);
      if (!product) throw new BadRequestException(`Product "${productId}" does not exist`);

      return {
        productId,
        productName: product.name,
        unitPrice: product.price,
        quantity,
        subtotal: toCents(product.price * quantity),
      };
    });
  }

  private sumTotal(items: OrderItem[]): number {
    return toCents(items.reduce((sum, item) => sum + item.subtotal, 0));
  }
}
