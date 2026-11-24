import { BaseEntity } from '../../core/entities/base.entity';

/** Opaque refresh token issued on login and rotated by POST /auth/refresh. */
export class RefreshTokenEntity extends BaseEntity {
  token: string;
  userId: string;
  expiresAt: Date;
  /** Shared by every token of one session: a login starts a family and each refresh continues it. */
  familyId: string;
  /** When a refresh exchanged this token; `null` while it is the family's current token. */
  rotatedAt: Date | null;
}
