import { Role } from '../../core/decorators/roles.decorator';
import { UsersRepository } from './users.repository';

describe('UsersRepository', () => {
  let repo: UsersRepository;

  beforeEach(() => {
    repo = new UsersRepository();
    repo.create({ email: 'Admin@Mock.dev', password: 'hash', name: 'Admin User', role: Role.Admin });
  });

  describe('findByEmail', () => {
    it('finds a user ignoring case', () => {
      expect(repo.findByEmail('admin@mock.dev')?.name).toBe('Admin User');
    });

    it('returns undefined when no user has that email', () => {
      expect(repo.findByEmail('nobody@mock.dev')).toBeUndefined();
    });
  });
});
