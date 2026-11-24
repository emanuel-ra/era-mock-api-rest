import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersRepository } from './repositories/users.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { REFRESH_TOKEN_TTL_MS, refreshTokenTtlFromConfig } from './refresh-token.config';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'fallback-secret'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    UsersRepository,
    RefreshTokensRepository,
    // Resolved on boot, so an invalid JWT_REFRESH_EXPIRES_IN stops the app.
    { provide: REFRESH_TOKEN_TTL_MS, inject: [ConfigService], useFactory: refreshTokenTtlFromConfig },
  ],
  exports: [AuthService, UsersRepository, RefreshTokensRepository],
})
export class AuthModule {}
