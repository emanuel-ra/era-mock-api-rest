# Adding a new resource

1. Create `src/<resource>/<resource>.entity.ts` extending `BaseEntity`.
2. Create `src/<resource>/<resource>.repository.ts` extending `InMemoryRepository<Entity>`.
3. Add DTOs (create, update, filter) — filter should extend `PaginationDto`.
4. Create service + controller following the existing customers/products pattern.
5. Register everything in a new module and import it in `AppModule`.
6. Inject the new repository into `SeedService` and add a seed method.
7. Document the new module and its endpoints in [features.md](features.md).
