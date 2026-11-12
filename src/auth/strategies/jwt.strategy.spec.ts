import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../core/decorators/roles.decorator';
import { UsersRepository } from '../repositories/users.repository';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let usersRepo: UsersRepository;

  beforeEach(() => {
    usersRepo = new UsersRepository();
    const config = { get: jest.fn().mockReturnValue('test-secret') } as unknown as ConfigService;
    strategy = new JwtStrategy(config, usersRepo);

    usersRepo.create(
      { email: 'user@mock.dev', password: 'hash', name: 'Regular User', role: Role.User },
      'user-2',
    );
  });

  it('returns the current user data for a known subject', () => {
    expect(strategy.validate({ sub: 'user-2', email: 'user@mock.dev', role: Role.User })).toEqual({
      id: 'user-2',
      email: 'user@mock.dev',
      role: Role.User,
    });
  });

  it('trusts the stored role over the role in the token', () => {
    const result = strategy.validate({ sub: 'user-2', email: 'user@mock.dev', role: Role.Admin });

    expect(result.role).toBe(Role.User);
  });

  it('rejects a token whose user no longer exists', () => {
    expect(() =>
      strategy.validate({ sub: 'deleted', email: 'gone@mock.dev', role: Role.Admin }),
    ).toThrow(UnauthorizedException);
  });
});
