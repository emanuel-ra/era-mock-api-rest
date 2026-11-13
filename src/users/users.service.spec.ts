import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UsersRepository } from '../auth/repositories/users.repository';
import { Role } from '../core/decorators/roles.decorator';
import { SortOrder } from '../core/utils/sort';
import { CreateUserDto } from './dto/create-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: UsersRepository;

  const ADMIN_ID = 'admin-1';

  const dto = (overrides: Partial<CreateUserDto> = {}): CreateUserDto => ({
    name: 'Jane Doe',
    email: 'jane@mock.dev',
    password: 'secret123',
    ...overrides,
  });

  const filters = (overrides: Partial<FilterUsersDto> = {}): FilterUsersDto =>
    ({ page: 1, limit: 10, order: SortOrder.Asc, ...overrides }) as FilterUsersDto;

  beforeEach(async () => {
    // The repository is in memory, so the tests use the real one.
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, UsersRepository],
    }).compile();

    service = moduleRef.get(UsersService);
    repo = moduleRef.get(UsersRepository);

    repo.create(
      { email: 'admin@mock.dev', password: 'hash', name: 'Admin User', role: Role.Admin },
      ADMIN_ID,
    );
  });

  describe('create', () => {
    it('hashes the password and never returns it', async () => {
      const created = await service.create(dto());

      expect(created).not.toHaveProperty('password');
      const stored = repo.findById(created.id)!;
      expect(stored.password).not.toBe('secret123');
      await expect(bcrypt.compare('secret123', stored.password)).resolves.toBe(true);
    });

    it('defaults the role to user', async () => {
      await expect(service.create(dto())).resolves.toMatchObject({ role: Role.User });
    });

    it('keeps the role that was sent', async () => {
      await expect(service.create(dto({ role: Role.Viewer }))).resolves.toMatchObject({
        role: Role.Viewer,
      });
    });

    it('throws ConflictException when the email exists, ignoring case', async () => {
      await expect(service.create(dto({ email: 'ADMIN@mock.dev' }))).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll / findOne', () => {
    it('returns a page of users without passwords', async () => {
      await service.create(dto());

      const result = service.findAll(filters());

      expect(result.meta.total).toBe(2);
      result.data.forEach((u) => expect(u).not.toHaveProperty('password'));
    });

    it('filters by role and sorts', async () => {
      await service.create(dto({ name: 'Zed', email: 'zed@mock.dev' }));
      await service.create(dto({ name: 'Amy', email: 'amy@mock.dev' }));

      const result = service.findAll(filters({ role: Role.User, sortBy: 'name' }));

      expect(result.data.map((u) => u.name)).toEqual(['Amy', 'Zed']);
    });

    it('findOne returns the user without the password', () => {
      const user = service.findOne(ADMIN_ID);

      expect(user).toMatchObject({ id: ADMIN_ID, email: 'admin@mock.dev' });
      expect(user).not.toHaveProperty('password');
    });

    it('findOne throws NotFoundException for an unknown id', () => {
      expect(() => service.findOne('missing')).toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates fields and re-hashes a new password', async () => {
      const created = await service.create(dto());

      const updated = await service.update(
        created.id,
        { name: 'Jane Smith', password: 'newpass1' },
        ADMIN_ID,
      );

      expect(updated).toMatchObject({ name: 'Jane Smith' });
      expect(updated).not.toHaveProperty('password');
      await expect(bcrypt.compare('newpass1', repo.findById(created.id)!.password)).resolves.toBe(
        true,
      );
    });

    it('keeps the password when none is sent', async () => {
      const created = await service.create(dto());
      const before = repo.findById(created.id)!.password;

      await service.update(created.id, { name: 'Jane Smith' }, ADMIN_ID);

      expect(repo.findById(created.id)!.password).toBe(before);
    });

    it('allows keeping the same email', async () => {
      const created = await service.create(dto());

      await expect(
        service.update(created.id, { email: 'JANE@mock.dev' }, ADMIN_ID),
      ).resolves.toMatchObject({ email: 'JANE@mock.dev' });
    });

    it('throws ConflictException when the email belongs to another user', async () => {
      const created = await service.create(dto());

      await expect(
        service.update(created.id, { email: 'admin@mock.dev' }, ADMIN_ID),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when an admin removes their own admin role', async () => {
      await expect(service.update(ADMIN_ID, { role: Role.User }, ADMIN_ID)).rejects.toThrow(
        ConflictException,
      );
      expect(repo.findById(ADMIN_ID)!.role).toBe(Role.Admin);
    });

    it('lets an admin update their own data while keeping the admin role', async () => {
      await expect(
        service.update(ADMIN_ID, { name: 'Boss', role: Role.Admin }, ADMIN_ID),
      ).resolves.toMatchObject({ name: 'Boss', role: Role.Admin });
    });

    it('lets an admin demote another admin', async () => {
      const other = await service.create(dto({ role: Role.Admin }));

      await expect(
        service.update(other.id, { role: Role.Viewer }, ADMIN_ID),
      ).resolves.toMatchObject({ role: Role.Viewer });
    });

    it('throws NotFoundException for an unknown id', async () => {
      await expect(service.update('missing', { name: 'X Y' }, ADMIN_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('deletes another user', async () => {
      const created = await service.create(dto());

      service.remove(created.id, ADMIN_ID);

      expect(repo.findById(created.id)).toBeUndefined();
    });

    it('throws ConflictException when an admin deletes themselves', () => {
      expect(() => service.remove(ADMIN_ID, ADMIN_ID)).toThrow(ConflictException);
      expect(repo.findById(ADMIN_ID)).toBeDefined();
    });

    it('throws NotFoundException for an unknown id', () => {
      expect(() => service.remove('missing', ADMIN_ID)).toThrow(NotFoundException);
    });
  });
});
