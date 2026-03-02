---
name: prisma
description: Prisma v7 setup with pg driver adapter for Next.js + Bun. Use when scaffolding Prisma in a new project, writing schema models, creating the singleton client, or configuring prisma.config.ts.
---

# Prisma v7 Standard Setup

Portable Prisma v7 configuration using `@prisma/adapter-pg` driver adapter, designed for Next.js + Bun.

## Scaffolding

When setting up Prisma in a new project, copy these files:

```
prisma.config.ts        → <root>/prisma.config.ts
prisma/schema.prisma    → <root>/prisma/schema.prisma
prisma/seed.ts          → <root>/prisma/seed.ts
lib/prisma.ts           → <root>/lib/prisma.ts
```

Install dependencies:

```sh
bun add prisma @prisma/client @prisma/adapter-pg pg dotenv
bun add -d @types/pg
```

Required env var:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
```

## File Templates

### prisma.config.ts (project root)

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun run prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

### prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}
```

### lib/prisma.ts (singleton client)

```ts
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

### prisma/seed.ts

```ts
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  // Add seed operations here
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

## Schema Conventions

| Convention | Rule |
|-----------|------|
| Table mapping | `@@map("snake_case")` on every model |
| Column mapping | `@map("snake_case")` on camelCase fields |
| IDs | `@default(cuid())` unless singleton pattern needed |
| Timestamps | `createdAt`/`updatedAt` with `@map("created_at")`/`@map("updated_at")` |
| Indexes | Explicit `@@index` on frequently queried columns |
| Output | `../generated/prisma` (keeps project root clean) |

### Example Model

```prisma
model Example {
  id        String   @id @default(cuid())
  name      String
  value     Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([createdAt])
  @@map("examples")
}
```

## Commands

```sh
bunx prisma generate       # Generate client to generated/prisma/
bunx prisma migrate dev    # Create and apply migrations
bunx prisma db seed        # Run prisma/seed.ts
```

## Key Details

- **Output path** is `generated/prisma/` (non-default) — adjust import paths accordingly
- **Singleton client** uses `globalThis` caching to prevent connection leaks during Next.js hot reload
- **Driver adapter** (`@prisma/adapter-pg`) gives direct control over the connection pool
- **prisma.config.ts** must live at project root (Prisma v7 requirement)
