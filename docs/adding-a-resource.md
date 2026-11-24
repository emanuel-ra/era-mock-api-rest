# Adding a new resource

1. Create `src/<resource>/<resource>.entity.ts` extending `BaseEntity`.
2. Create `src/<resource>/<resource>.repository.ts` extending `InMemoryRepository<Entity>`.
3. Add DTOs (create, update, filter) — filter should extend `PaginationDto` and declare `sortBy` with `@IsIn` over a `<RESOURCE>_SORT_FIELDS` whitelist; the service applies `sortItems()` before `paginate()`.
4. Create service + controller following the existing customers/products pattern.
5. Register everything in a new module and import it in `AppModule`.
6. Inject the new repository into `SeedService` and add a seed method.
7. Add unit tests (`*.spec.ts` next to the service and repository) and e2e tests (`test/<resource>.e2e-spec.ts`).
8. Document the new module and its endpoints in [features.md](features.md).
9. Add a `bruno/<Resource>/` folder with its requests to the Bruno collection (see `.claude/rules/feature-docs.md`).

If two modules need each other's providers (e.g. `products` and `categories`), import each one with `forwardRef(() => OtherModule)`. See [architecture.md](architecture.md).
