import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { UserEntity } from '../../auth/entities/user.entity';
import { PaginationDto } from '../../core/dto/pagination.dto';
import { Role } from '../../core/decorators/roles.decorator';

export const USER_SORT_FIELDS = [
  'name',
  'email',
  'role',
  'createdAt',
] as const satisfies ReadonlyArray<keyof UserEntity>;

export class FilterUsersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Substring, case-insensitive' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Substring, case-insensitive' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: USER_SORT_FIELDS,
    description: 'Field to sort by. Without it the default order is kept.',
  })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: (typeof USER_SORT_FIELDS)[number];
}
