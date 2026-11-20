import { BaseEntity } from '../../core/entities/base.entity';

/** Opaque refresh token issued on login and rotated by POST /auth/refresh. */
export class RefreshTokenEntity extends BaseEntity {
  token: string;
  userId: string;
  expiresAt: Date;
}
