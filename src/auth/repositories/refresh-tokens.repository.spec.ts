import { RefreshTokensRepository } from './refresh-tokens.repository';

describe('RefreshTokensRepository', () => {
  let repo: RefreshTokensRepository;

  beforeEach(() => {
    repo = new RefreshTokensRepository();
    repo.create({ token: 'AbC-123_x', userId: 'user-1', expiresAt: new Date('2030-01-01') });
  });

  describe('findByToken', () => {
    it('finds a token by its exact value', () => {
      expect(repo.findByToken('AbC-123_x')?.userId).toBe('user-1');
    });

    it('is case-sensitive', () => {
      expect(repo.findByToken('abc-123_x')).toBeUndefined();
    });

    it('returns undefined for an unknown token', () => {
      expect(repo.findByToken('missing')).toBeUndefined();
    });
  });
});
