import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Role } from '../core/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { UsersRepository } from './repositories/users.repository';

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: UsersRepository;
  const jwtService = { sign: jest.fn().mockReturnValue('signed-token') };

  beforeEach(async () => {
    jwtService.sign.mockClear();

    // The testing module wires dependencies like the real AuthModule, but
    // JwtService is replaced by a mock so no real secret is needed.
    const moduleRef = await Test.createTestingModule({
      providers: [AuthService, UsersRepository, { provide: JwtService, useValue: jwtService }],
    }).compile();

    service = moduleRef.get(AuthService);
    usersRepo = moduleRef.get(UsersRepository);

    usersRepo.create(
      {
        email: 'admin@mock.dev',
        password: await bcrypt.hash('password123', 4),
        name: 'Admin User',
        role: Role.Admin,
      },
      'user-1',
    );
  });

  describe('login', () => {
    it('returns a token and the public user data for valid credentials', async () => {
      const result = await service.login({ email: 'admin@mock.dev', password: 'password123' });

      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: 'user-1', email: 'admin@mock.dev', name: 'Admin User', role: Role.Admin },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'admin@mock.dev',
        role: Role.Admin,
      });
    });

    it('matches the email case-insensitively', async () => {
      await expect(
        service.login({ email: 'ADMIN@mock.dev', password: 'password123' }),
      ).resolves.toHaveProperty('accessToken');
    });

    it('rejects an unknown email', async () => {
      await expect(
        service.login({ email: 'nobody@mock.dev', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      await expect(
        service.login({ email: 'admin@mock.dev', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('returns the user without the password', () => {
      const me = service.getMe('user-1');

      expect(me).toMatchObject({ id: 'user-1', email: 'admin@mock.dev', role: Role.Admin });
      expect(me).not.toHaveProperty('password');
    });

    it('throws NotFoundException for an unknown user', () => {
      expect(() => service.getMe('missing')).toThrow(NotFoundException);
    });
  });
});
