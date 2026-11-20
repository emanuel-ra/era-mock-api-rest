import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
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
   * Strict rotation with reuse detection: the refresh token is marked as
   * rotated and a new access + refresh pair of the same family is issued.
   * A rotated token that comes back means it leaked (or two refreshes raced),
   * so its whole family is revoked. Unknown, expired or reused tokens, and
   * tokens whose user was deleted, all fail with the same 401.
   */
  refresh(token: string): AuthResponseDto {
    const stored = this.refreshTokensRepository.findByToken(token);
    if (!stored) throw new UnauthorizedException(INVALID_REFRESH_TOKEN);

    // Reuse, expiry and a deleted user end the session: the family is deleted,
    // which also cleans up its rotated tokens.
    if (stored.rotatedAt || stored.expiresAt.getTime() <= Date.now()) {
      this.refreshTokensRepository.deleteFamily(stored.familyId);
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    // Read the user again so the new access token carries the current role.
    const user = this.usersRepository.findById(stored.userId);
    if (!user) {
      this.refreshTokensRepository.deleteFamily(stored.familyId);
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    // Kept (not deleted) so a later reuse can be detected.
    this.refreshTokensRepository.update(stored.id, { rotatedAt: new Date() });
    return this.buildResponse(user, stored.familyId);
  }

  /**
   * Revokes the whole family (session) of the refresh token, whether it is the
   * current token or an already rotated one. Idempotent: unknown tokens are
   * ignored. Access tokens are not revoked; they stay valid until they expire.
   */
  logout(token: string): void {
    const stored = this.refreshTokensRepository.findByToken(token);
    if (stored) this.refreshTokensRepository.deleteFamily(stored.familyId);
  }

  getMe(userId: string): Omit<UserEntity, 'password'> {
    const user = this.usersRepository.findByIdOrFail(userId);
    const { password: _, ...safe } = user;
    return safe;
  }

  /** A login starts a new family; a refresh passes the family it continues. */
  private buildResponse(user: UserEntity, familyId: string = randomUUID()): AuthResponseDto {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.issueRefreshToken(user.id, familyId),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  private issueRefreshToken(userId: string, familyId: string): string {
    const token = randomBytes(32).toString('base64url');
    this.refreshTokensRepository.create({
      token,
      userId,
      expiresAt: new Date(Date.now() + this.refreshTokenTtlMs),
      familyId,
      rotatedAt: null,
    });
    return token;
  }

  getUsersRepository(): UsersRepository {
    return this.usersRepository;
  }
}
