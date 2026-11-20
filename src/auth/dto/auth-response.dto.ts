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
  @ApiProperty({
    description: 'Opaque token for POST /auth/refresh. Single use: each refresh returns a new one.',
  })
  refreshToken: string;
  @ApiProperty() user: AuthUserDto;
}
