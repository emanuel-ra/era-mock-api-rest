export interface IRepository<T extends { id: string }> {
  findAll(filters?: Partial<Omit<T, 'id'>>): T[];
  findById(id: string): T | undefined;
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T;
  update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): T | undefined;
  delete(id: string): boolean;
  count(): number;
  clear(): void;
}
