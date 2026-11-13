import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from '../auth/entities/user.entity';
import { UsersRepository } from '../auth/repositories/users.repository';
import { Role } from '../core/decorators/roles.decorator';
import { paginate, PaginatedResult } from '../core/dto/pagination.dto';
import { sortItems } from '../core/utils/sort';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** A user as the API returns it: never with the password hash. */
export type PublicUser = Omit<UserEntity, 'password'>;

const BCRYPT_ROUNDS = 10;

function toPublic(user: UserEntity): PublicUser {
  const { password: _, ...rest } = user;
  return rest;
}

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  findAll(filters: FilterUsersDto): PaginatedResult<PublicUser> {
    const { page, limit, sortBy, order, ...rest } = filters;
    const result = paginate(sortItems(this.repo.findAll(rest), sortBy, order), page, limit);
    return { ...result, data: result.data.map(toPublic) };
  }

  findOne(id: string): PublicUser {
    return toPublic(this.repo.findByIdOrFail(id));
  }

  async create(dto: CreateUserDto): Promise<PublicUser> {
    this.assertEmailFree(dto.email);

    const user = this.repo.create({
      name: dto.name,
      email: dto.email,
      role: dto.role ?? Role.User,
      password: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
    });
    return toPublic(user);
  }

  /** `currentUserId` is the admin making the request. */
  async update(id: string, dto: UpdateUserDto, currentUserId: string): Promise<PublicUser> {
    this.repo.findByIdOrFail(id);
    if (dto.email) this.assertEmailFree(dto.email, id);

    // An admin who demotes themselves would lose access to this endpoint at once.
    if (id === currentUserId && dto.role !== undefined && dto.role !== Role.Admin) {
      throw new ConflictException('You cannot remove the admin role from yourself');
    }

    const { password, ...rest } = dto;
    const data: Partial<UserEntity> = { ...rest };
    if (password !== undefined) data.password = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // findByIdOrFail above guarantees the user exists.
    return toPublic(this.repo.update(id, data)!);
  }

  remove(id: string, currentUserId: string): void {
    this.repo.findByIdOrFail(id);
    if (id === currentUserId) {
      throw new ConflictException('You cannot delete your own user');
    }
    // The deleted user's tokens stop working: JwtStrategy checks the store on every request.
    this.repo.delete(id);
  }

  private assertEmailFree(email: string, exceptId?: string): void {
    const existing = this.repo.findByEmail(email);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }
  }
}
