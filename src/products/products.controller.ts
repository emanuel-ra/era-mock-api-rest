import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles, Role } from '../core/decorators/roles.decorator';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { RolesGuard } from '../core/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly service: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List products (paginated + filterable)' })
  findAll(@Query() filters: FilterProductsDto) {
    return this.service.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product by id' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Create a product' })
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.Admin, Role.User)
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a product (Admin only)' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
