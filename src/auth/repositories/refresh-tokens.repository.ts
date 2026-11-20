import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/repositories/in-memory.repository';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';

@Injectable()
export class RefreshTokensRepository extends InMemoryRepository<RefreshTokenEntity> {
  /** Exact, case-sensitive match: tokens are random base64url strings. */
  findByToken(token: string): RefreshTokenEntity | undefined {
    return Array.from(this.store.values()).find((t) => t.token === token);
  }
}
