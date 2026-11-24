import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { SalesQueryDto } from './dto/sales-query.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Totals for customers, products, orders and revenue' })
  summary() {
    return this.service.summary();
  }

  @Get('sales')
  @ApiOperation({ summary: 'Orders and revenue per day or month (paid, shipped and delivered orders)' })
  sales(@Query() query: SalesQueryDto) {
    return this.service.sales(query);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Best-selling products by quantity (includes deleted products)' })
  topProducts(@Query() query: TopProductsQueryDto) {
    return this.service.topProducts(query);
  }
}
