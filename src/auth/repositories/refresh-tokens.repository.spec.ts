import { RefreshTokensRepository } from './refresh-tokens.repository';

describe('RefreshTokensRepository', () => {
  let repo: RefreshTokensRepository;

  const add = (token: string, familyId: string) =>
    repo.create({ token, userId: 'user-1', expiresAt: new Date('2030-01-01'), familyId, rotatedAt: null });

  beforeEach(() => {
    repo = new RefreshTokensRepository();
    add('AbC-123_x', 'family-1');
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

  describe('deleteFamily', () => {
    it('deletes every token of the family and returns how many', () => {
      add('second', 'family-1');

      expect(repo.deleteFamily('family-1')).toBe(2);
      expect(repo.count()).toBe(0);
    });

    it('keeps the tokens of other families', () => {
      add('other', 'family-2');

      repo.deleteFamily('family-1');

      expect(repo.findByToken('AbC-123_x')).toBeUndefined();
      expect(repo.findByToken('other')).toBeDefined();
    });

    it('returns 0 for an unknown family', () => {
      expect(repo.deleteFamily('missing')).toBe(0);
      expect(repo.count()).toBe(1);
    });
  });
});
