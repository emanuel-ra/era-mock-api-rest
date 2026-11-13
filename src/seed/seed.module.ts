import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { CustomersModule } from '../customers/customers.module';
import { ProductsModule } from '../products/products.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [AuthModule, CategoriesModule, CustomersModule, ProductsModule],
  providers: [SeedService],
  controllers: [SeedController],
})
export class SeedModule {}
