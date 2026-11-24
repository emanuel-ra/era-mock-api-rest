import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/repositories/in-memory.repository';
import { RefreshTokenEntity } from '../entities/refresh-token.entity';

@Injectable()
export class RefreshTokensRepository extends InMemoryRepository<RefreshTokenEntity> {
  /** Exact, case-sensitive match: tokens are random base64url strings. */
  findByToken(token: string): RefreshTokenEntity | undefined {
    return Array.from(this.store.values()).find((t) => t.token === token);
  }

  /** Deletes every token of a family (one login session) and returns how many were removed. */
  deleteFamily(familyId: string): number {
    let deleted = 0;
    for (const [id, stored] of this.store) {
      if (stored.familyId === familyId) {
        this.store.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}
