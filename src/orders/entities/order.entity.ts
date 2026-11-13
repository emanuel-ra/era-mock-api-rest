import { BaseEntity } from '../../core/entities/base.entity';

export enum OrderStatus {
  Pending = 'pending',
  Paid = 'paid',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
}

/** Status changes allowed by PATCH /orders/:id/status. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.Pending]: [OrderStatus.Paid, OrderStatus.Cancelled],
  [OrderStatus.Paid]: [OrderStatus.Shipped, OrderStatus.Cancelled],
  [OrderStatus.Shipped]: [OrderStatus.Delivered],
  [OrderStatus.Delivered]: [],
  [OrderStatus.Cancelled]: [],
};

/**
 * A line of the order. `productName` and `unitPrice` are copied from the product
 * when the line is saved, so later product changes (or deleting it) do not alter the order.
 */
export interface OrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export class OrderEntity extends BaseEntity {
  customerId: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  notes: string;
}
