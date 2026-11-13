import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

/** Read-only aggregates for dashboards. It only reads the other modules' repositories. */
@Module({
  imports: [CustomersModule, ProductsModule, OrdersModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
