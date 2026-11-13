import { CategoriesRepository } from './categories.repository';

describe('CategoriesRepository', () => {
  let repo: CategoriesRepository;

  beforeEach(() => {
    repo = new CategoriesRepository();
    repo.create({ name: 'Home & Garden', slug: 'home-garden', description: '', isActive: true });
  });

  it('finds a category by name ignoring case', () => {
    expect(repo.findByName('HOME & garden')?.slug).toBe('home-garden');
    expect(repo.findByName('Home')).toBeUndefined();
  });

  it('finds a category by slug ignoring case', () => {
    expect(repo.findBySlug('Home-Garden')?.name).toBe('Home & Garden');
    expect(repo.findBySlug('home')).toBeUndefined();
  });

  it('searches name by substring', () => {
    expect(repo.findAll({ name: 'garden' })).toHaveLength(1);
  });
});
