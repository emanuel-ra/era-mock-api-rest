import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../core/decorators/roles.decorator';

export class AuthUserDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() name: string;
  @ApiProperty({ enum: Role }) role: Role;
}

export class AuthResponseDto {
  @ApiProperty() accessToken: string;
  @ApiProperty() user: AuthUserDto;
}
