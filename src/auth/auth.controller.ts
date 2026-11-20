import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password -> returns an access and a refresh token' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new access + refresh token pair',
    description:
      'Public: send no Authorization header. The refresh token is single use (strict rotation): ' +
      'the one sent stops working, so parallel refreshes with the same token fail after the first. ' +
      'Do not retry a refresh after a 401 from this endpoint; log the user in again.',
  })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Missing, empty or non-string refreshToken, or extra fields' })
  @ApiUnauthorizedResponse({
    description: 'Invalid refresh token: unknown, expired, already used, or its user no longer exists',
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Invalidate a refresh token',
    description:
      'Public: send no Authorization header. Always answers 204, even if the token is unknown, ' +
      'expired or already used. The access token is not revoked and stays valid until it expires.',
  })
  @ApiNoContentResponse({ description: 'The refresh token no longer works (or never did)' })
  @ApiBadRequestResponse({ description: 'Missing, empty or non-string refreshToken, or extra fields' })
  logout(@Body() dto: RefreshTokenDto): void {
    this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  getMe(@Request() req: { user: { id: string } }) {
    return this.authService.getMe(req.user.id);
  }
}
