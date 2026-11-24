import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, TokenExpiredError } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();
  const context = {} as ExecutionContext;

  /** Runs handleRequest without a user and returns the 401 it throws. */
  function rejection(err: unknown, info: unknown): UnauthorizedException {
    try {
      guard.handleRequest(err, false, info, context);
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      return error as UnauthorizedException;
    }
    throw new Error('handleRequest did not throw');
  }

  it('returns the user of a valid token', () => {
    const user = { id: 'user-1' };

    expect(guard.handleRequest(null, user, undefined, context)).toBe(user);
  });

  it('answers "Token expired" for an expired token', () => {
    const info = new TokenExpiredError('jwt expired', new Date());

    expect(rejection(null, info).message).toBe('Token expired');
  });

  it.each([
    ['no token', new Error('No auth token')],
    ['a malformed token', new JsonWebTokenError('jwt malformed')],
    ['a wrong signature', new JsonWebTokenError('invalid signature')],
    ['no info', undefined],
  ])('answers "Unauthorized" for %s', (_case, info) => {
    expect(rejection(null, info).message).toBe('Unauthorized');
  });

  it('keeps the error thrown by the strategy', () => {
    const err = new UnauthorizedException('User no longer exists');

    expect(rejection(err, undefined)).toBe(err);
  });
});
