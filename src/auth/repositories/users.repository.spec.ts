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

  describe('findAll', () => {
    beforeEach(() => {
      repo.create({ email: 'viewer@mock.dev', password: 'hash', name: 'Viewer User', role: Role.Viewer });
    });

    it('matches name and email by substring, ignoring case', () => {
      expect(repo.findAll({ name: 'ADMIN' }).map((u) => u.name)).toEqual(['Admin User']);
      expect(repo.findAll({ email: 'viewer@' }).map((u) => u.name)).toEqual(['Viewer User']);
      expect(repo.findAll({ email: 'mock.dev' })).toHaveLength(2);
    });

    it('matches role exactly', () => {
      expect(repo.findAll({ role: Role.Viewer }).map((u) => u.name)).toEqual(['Viewer User']);
    });
  });
});
