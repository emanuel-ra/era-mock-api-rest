import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UsersRepository } from './repositories/users.repository';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserEntity } from './entities/user.entity';
import { REFRESH_TOKEN_TTL_MS } from './refresh-token.config';

/** Same message for every refresh failure, so callers cannot tell the causes apart. */
export const INVALID_REFRESH_TOKEN = 'Invalid refresh token';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly jwtService: JwtService,
    @Inject(REFRESH_TOKEN_TTL_MS) private readonly refreshTokenTtlMs: number,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = this.usersRepository.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const match = await bcrypt.compare(dto.password, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');

    return this.buildResponse(user);
  }

  /**
   * Strict rotation: the refresh token is consumed and a new access + refresh
   * pair is issued. Unknown, expired or already used tokens, and tokens whose
   * user was deleted, all fail with the same 401.
   */
  refresh(token: string): AuthResponseDto {
    const stored = this.refreshTokensRepository.findByToken(token);
    if (!stored) throw new UnauthorizedException(INVALID_REFRESH_TOKEN);

    // Consumed in every case: a valid token is rotated, and an expired token
    // or one whose user is gone is deleted lazily here.
    this.refreshTokensRepository.delete(stored.id);

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    // Read the user again so the new access token carries the current role.
    const user = this.usersRepository.findById(stored.userId);
    if (!user) throw new UnauthorizedException(INVALID_REFRESH_TOKEN);

    return this.buildResponse(user);
  }

  getMe(userId: string): Omit<UserEntity, 'password'> {
    const user = this.usersRepository.findByIdOrFail(userId);
    const { password: _, ...safe } = user;
    return safe;
  }

  private buildResponse(user: UserEntity): AuthResponseDto {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.issueRefreshToken(user.id),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  private issueRefreshToken(userId: string): string {
    const token = randomBytes(32).toString('base64url');
    this.refreshTokensRepository.create({
      token,
      userId,
      expiresAt: new Date(Date.now() + this.refreshTokenTtlMs),
    });
    return token;
  }

  getUsersRepository(): UsersRepository {
    return this.usersRepository;
  }
}
