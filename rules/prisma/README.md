# Prisma Standard

Portable Prisma v7 setup with `pg` driver adapter, designed for Next.js + Bun.

## What to Copy

Copy into your project root, preserving paths:

```
prisma.config.ts        → <root>/prisma.config.ts
schema.prisma           → <root>/prisma/schema.prisma
seed.ts                 → <root>/prisma/seed.ts
lib/prisma.ts           → <root>/lib/prisma.ts
```

## Dependencies

```sh
bun add prisma @prisma/client @prisma/adapter-pg pg dotenv
bun add -d @types/pg
```

## Environment

```
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

## Commands

```sh
bunx prisma generate       # Generate client to generated/prisma/
bunx prisma migrate dev    # Create and apply migrations
bunx prisma db seed        # Run prisma/seed.ts
```

## Conventions

- **Output path**: `generated/prisma/` (non-default, keeps project root clean)
- **Table mapping**: `@@map("snake_case")` on every model
- **Column mapping**: `@map("snake_case")` on camelCase fields
- **IDs**: `@default(cuid())` unless you need a singleton pattern
- **Timestamps**: `createdAt`/`updatedAt` with snake_case column maps
- **Indexes**: Explicit `@@index` on frequently queried columns
- **Singleton client**: `globalThis` caching prevents connection leaks during Next.js hot reload
- **Config**: `prisma.config.ts` lives at project root (Prisma v7 requirement)
