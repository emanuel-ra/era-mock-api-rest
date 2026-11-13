import { Injectable } from '@nestjs/common';
import { InMemoryRepository } from '../../core/repositories/in-memory.repository';
import { UserEntity } from '../entities/user.entity';

@Injectable()
export class UsersRepository extends InMemoryRepository<UserEntity> {
  protected readonly searchableFields: ReadonlyArray<keyof UserEntity> = ['name', 'email'];

  findByEmail(email: string): UserEntity | undefined {
    return Array.from(this.store.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  }
}
