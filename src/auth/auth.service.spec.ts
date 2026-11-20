import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Role } from '../core/decorators/roles.decorator';
import { AuthService, INVALID_REFRESH_TOKEN } from './auth.service';
import { REFRESH_TOKEN_TTL_MS } from './refresh-token.config';
import { RefreshTokensRepository } from './repositories/refresh-tokens.repository';
import { UsersRepository } from './repositories/users.repository';

const TTL_MS = 60_000;

describe('AuthService', () => {
  let service: AuthService;
  let usersRepo: UsersRepository;
  let refreshRepo: RefreshTokensRepository;
  const jwtService = { sign: jest.fn().mockReturnValue('signed-token') };

  beforeEach(async () => {
    jwtService.sign.mockClear();

    // The testing module wires dependencies like the real AuthModule, but
    // JwtService is replaced by a mock so no real secret is needed.
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        UsersRepository,
        RefreshTokensRepository,
        { provide: JwtService, useValue: jwtService },
        { provide: REFRESH_TOKEN_TTL_MS, useValue: TTL_MS },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    usersRepo = moduleRef.get(UsersRepository);
    refreshRepo = moduleRef.get(RefreshTokensRepository);

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

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('login', () => {
    it('returns an access token, a refresh token and the public user data', async () => {
      const result = await service.login({ email: 'admin@mock.dev', password: 'password123' });

      expect(result).toEqual({
        accessToken: 'signed-token',
        refreshToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        user: { id: 'user-1', email: 'admin@mock.dev', name: 'Admin User', role: Role.Admin },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'admin@mock.dev',
        role: Role.Admin,
      });
    });

    it('stores the refresh token with its user and expiry', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-20T10:00:00.000Z') });

      const { refreshToken } = await service.login({ email: 'admin@mock.dev', password: 'password123' });

      expect(refreshRepo.findByToken(refreshToken)).toMatchObject({
        userId: 'user-1',
        expiresAt: new Date(Date.parse('2026-11-20T10:00:00.000Z') + TTL_MS),
      });
    });

    it('issues a different refresh token on each login', async () => {
      const a = await service.login({ email: 'admin@mock.dev', password: 'password123' });
      const b = await service.login({ email: 'admin@mock.dev', password: 'password123' });

      expect(a.refreshToken).not.toBe(b.refreshToken);
      expect(refreshRepo.count()).toBe(2);
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

    it('rejects a wrong password without issuing tokens', async () => {
      await expect(
        service.login({ email: 'admin@mock.dev', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(jwtService.sign).not.toHaveBeenCalled();
      expect(refreshRepo.count()).toBe(0);
    });
  });

  describe('refresh', () => {
    const login = () => service.login({ email: 'admin@mock.dev', password: 'password123' });

    it('rotates the refresh token and returns a new pair of the same family', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-20T10:00:00.000Z') });
      const { refreshToken } = await login();

      const result = service.refresh(refreshToken);

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).not.toBe(refreshToken);
      expect(result.user).toEqual({ id: 'user-1', email: 'admin@mock.dev', name: 'Admin User', role: Role.Admin });
      const old = refreshRepo.findByToken(refreshToken)!;
      const next = refreshRepo.findByToken(result.refreshToken)!;
      expect(old.rotatedAt).toEqual(new Date('2026-11-20T10:00:00.000Z'));
      expect(next.rotatedAt).toBeNull();
      expect(next.familyId).toBe(old.familyId);
    });

    it('starts a new family on each login', async () => {
      const a = await login();
      const b = await login();

      expect(refreshRepo.findByToken(a.refreshToken)!.familyId).not.toBe(
        refreshRepo.findByToken(b.refreshToken)!.familyId,
      );
    });

    it('rejects a reused token and revokes its whole family', async () => {
      const { refreshToken: r1 } = await login();
      const { refreshToken: r2 } = service.refresh(r1);

      expect(() => service.refresh(r1)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
      expect(refreshRepo.count()).toBe(0);
      expect(() => service.refresh(r2)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
    });

    it('revokes the family when any older token of it is reused', async () => {
      const { refreshToken: r1 } = await login();
      const { refreshToken: r2 } = service.refresh(r1);
      const { refreshToken: r3 } = service.refresh(r2);

      expect(() => service.refresh(r1)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
      expect(refreshRepo.findByToken(r3)).toBeUndefined();
    });

    it('keeps other families working when one is revoked', async () => {
      const first = await login();
      const second = await login();
      service.refresh(first.refreshToken);

      expect(() => service.refresh(first.refreshToken)).toThrow(UnauthorizedException);

      expect(service.refresh(second.refreshToken).refreshToken).toEqual(expect.any(String));
    });

    it('rejects an unknown token', () => {
      expect(() => service.refresh('unknown')).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
    });

    it('rejects an expired token and deletes it', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-20T10:00:00.000Z') });
      const { refreshToken } = await login();

      jest.setSystemTime(Date.parse('2026-11-20T10:00:00.000Z') + TTL_MS);

      expect(() => service.refresh(refreshToken)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
      expect(refreshRepo.count()).toBe(0);
    });

    it('accepts a token right before it expires', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-20T10:00:00.000Z') });
      const { refreshToken } = await login();

      jest.setSystemTime(Date.parse('2026-11-20T10:00:00.000Z') + TTL_MS - 1);

      expect(service.refresh(refreshToken).refreshToken).toEqual(expect.any(String));
    });

    it('rejects the token of a deleted user and deletes it', async () => {
      const { refreshToken } = await login();
      usersRepo.delete('user-1');

      expect(() => service.refresh(refreshToken)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
      expect(refreshRepo.count()).toBe(0);
    });

    it('signs the new access token with the current role', async () => {
      const { refreshToken } = await login();
      usersRepo.update('user-1', { role: Role.Viewer });
      jwtService.sign.mockClear();

      const result = service.refresh(refreshToken);

      expect(result.user.role).toBe(Role.Viewer);
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'user-1', email: 'admin@mock.dev', role: Role.Viewer });
    });
  });

  describe('logout', () => {
    const login = () => service.login({ email: 'admin@mock.dev', password: 'password123' });

    it('deletes the refresh token so it can no longer be refreshed', async () => {
      const { refreshToken } = await login();

      service.logout(refreshToken);

      expect(refreshRepo.findByToken(refreshToken)).toBeUndefined();
      expect(() => service.refresh(refreshToken)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
    });

    it('ignores an unknown token', () => {
      expect(() => service.logout('unknown')).not.toThrow();
    });

    it('revokes the whole family, including tokens issued by refreshes', async () => {
      const { refreshToken: r1 } = await login();
      const { refreshToken: r2 } = service.refresh(r1);

      service.logout(r2);

      expect(refreshRepo.count()).toBe(0);
      expect(() => service.refresh(r1)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
      expect(() => service.refresh(r2)).toThrow(new UnauthorizedException(INVALID_REFRESH_TOKEN));
    });

    it('revokes the family when given an already rotated token', async () => {
      const { refreshToken: r1 } = await login();
      service.refresh(r1);

      expect(() => service.logout(r1)).not.toThrow();
      expect(refreshRepo.count()).toBe(0);
    });

    it('keeps the other sessions of the same user', async () => {
      const first = await login();
      const second = await login();

      service.logout(first.refreshToken);

      expect(refreshRepo.findByToken(second.refreshToken)).toBeDefined();
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
