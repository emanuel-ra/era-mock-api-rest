import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token from POST /auth/login or a previous POST /auth/refresh',
    example: 'q3Jx0sZ1e9wJ2Yb3c4d5e6f7g8h9i0jKlMnOpQrStUv',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
