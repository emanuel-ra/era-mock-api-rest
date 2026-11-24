import { BadRequestException, Injectable } from '@nestjs/common';
import { toCents } from '../core/utils/money';
import { CustomersRepository } from '../customers/customers.repository';
import { OrderEntity, OrderStatus } from '../orders/entities/order.entity';
import { OrdersRepository } from '../orders/orders.repository';
import { ProductStatus } from '../products/entities/product.entity';
import { ProductsRepository } from '../products/products.repository';
import { SalesGroupBy, SalesQueryDto } from './dto/sales-query.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';

/** Orders in these statuses count as sales (revenue, sales series and top products). */
export const SALE_STATUSES: readonly OrderStatus[] = [
  OrderStatus.Paid,
  OrderStatus.Shipped,
  OrderStatus.Delivered,
];

/** Products with stock below this value count as low stock. */
export const LOW_STOCK_THRESHOLD = 5;

/** Longest range allowed with `groupBy=day`, to keep the series a sensible size. */
export const MAX_DAILY_RANGE_DAYS = 366;

/** Number of days in the default range when `from` is omitted (`to` included). */
const DEFAULT_RANGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SalesPoint {
  period: string;
  orders: number;
  revenue: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}

@Injectable()
export class StatsService {
  constructor(
    private readonly customersRepo: CustomersRepository,
    private readonly productsRepo: ProductsRepository,
    private readonly ordersRepo: OrdersRepository,
  ) {}

  summary() {
    const customers = this.customersRepo.findAll();
    const products = this.productsRepo.findAll();
    const orders = this.ordersRepo.findAll();

    const byStatus = Object.fromEntries(Object.values(OrderStatus).map((s) => [s, 0])) as Record<
      OrderStatus,
      number
    >;
    for (const order of orders) byStatus[order.status]++;

    return {
      customers: {
        total: customers.length,
        active: customers.filter((c) => c.isActive).length,
      },
      products: {
        total: products.length,
        outOfStock: products.filter((p) => p.status === ProductStatus.OutOfStock).length,
        lowStock: products.filter((p) => p.stock < LOW_STOCK_THRESHOLD).length,
      },
      orders: { total: orders.length, byStatus },
      revenue: { total: sumTotals(orders.filter(isSale)) },
    };
  }

  /**
   * Sales per day or month between `from` and `to` (UTC days, both included).
   * Periods without sales are returned with zeros so charts have no gaps.
   */
  sales(query: SalesQueryDto): SalesPoint[] {
    const groupBy = query.groupBy ?? SalesGroupBy.Day;
    const to = query.to ? parseDay(query.to, 'to') : startOfUtcDay(new Date());
    const from = query.from
      ? parseDay(query.from, 'from')
      : new Date(to.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);

    if (from > to) throw new BadRequestException('from must be on or before to');
    const days = (to.getTime() - from.getTime()) / DAY_MS + 1;
    if (groupBy === SalesGroupBy.Day && days > MAX_DAILY_RANGE_DAYS) {
      throw new BadRequestException(
        `Ranges longer than ${MAX_DAILY_RANGE_DAYS} days must use groupBy=month`,
      );
    }

    const buckets = new Map<string, OrderEntity[]>();
    for (const period of listPeriods(from, to, groupBy)) buckets.set(period, []);

    const start = from.getTime();
    const end = to.getTime() + DAY_MS; // `to` is included up to the end of the day
    for (const order of this.ordersRepo.findAll()) {
      const time = order.createdAt.getTime();
      if (!isSale(order) || time < start || time >= end) continue;
      buckets.get(periodOf(order.createdAt, groupBy))?.push(order);
    }

    return Array.from(buckets, ([period, orders]) => ({
      period,
      orders: orders.length,
      revenue: sumTotals(orders),
    }));
  }

  /**
   * Best-selling products by quantity, read from the order lines, so deleted
   * products still appear, with the name they had in their latest order.
   */
  topProducts(query: TopProductsQueryDto): TopProduct[] {
    const totals = new Map<string, TopProduct & { lastSeen: number }>();

    for (const order of this.ordersRepo.findAll().filter(isSale)) {
      const time = order.createdAt.getTime();
      for (const item of order.items) {
        const entry = totals.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          quantity: 0,
          revenue: 0,
          lastSeen: time,
        };
        entry.quantity += item.quantity;
        entry.revenue = toCents(entry.revenue + item.subtotal);
        if (time >= entry.lastSeen) {
          entry.productName = item.productName;
          entry.lastSeen = time;
        }
        totals.set(item.productId, entry);
      }
    }

    return Array.from(totals.values())
      .sort(
        (a, b) =>
          b.quantity - a.quantity ||
          b.revenue - a.revenue ||
          a.productName.localeCompare(b.productName),
      )
      .slice(0, query.limit ?? 5)
      .map(({ productId, productName, quantity, revenue }) => ({
        productId,
        productName,
        quantity,
        revenue,
      }));
  }
}

function isSale(order: OrderEntity): boolean {
  return SALE_STATUSES.includes(order.status);
}

function sumTotals(orders: OrderEntity[]): number {
  return toCents(orders.reduce((sum, o) => sum + o.total, 0));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** `YYYY-MM-DD` for days, `YYYY-MM` for months (UTC). */
function periodOf(date: Date, groupBy: SalesGroupBy): string {
  return date.toISOString().slice(0, groupBy === SalesGroupBy.Day ? 10 : 7);
}

/** Parses `YYYY-MM-DD` as UTC midnight and rejects days that do not exist (e.g. 2026-02-30). */
function parseDay(value: string, field: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a valid date`);
  }
  return date;
}

function listPeriods(from: Date, to: Date, groupBy: SalesGroupBy): string[] {
  const periods: string[] = [];
  if (groupBy === SalesGroupBy.Day) {
    for (let t = from.getTime(); t <= to.getTime(); t += DAY_MS) {
      periods.push(periodOf(new Date(t), groupBy));
    }
    return periods;
  }
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    periods.push(periodOf(cursor, groupBy));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return periods;
}
