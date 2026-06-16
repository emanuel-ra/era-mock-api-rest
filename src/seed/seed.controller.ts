import { Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeedService } from './seed.service';

@ApiTags('Seed')
@Controller('seed')
export class SeedController {
  constructor(private readonly seedService: SeedService) {}

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all data and re-seed with fresh Faker data' })
  async reset() {
    await this.seedService.reset();
    return { message: 'Data re-seeded successfully', ...this.seedService.status() };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get record count per module' })
  status() {
    return this.seedService.status();
  }
}
