# AGENTS.md

## Stack

- Bun
- Turborepo
- Next.js
- TypeScript
- tRPC
- Drizzle ORM
- PostgreSQL
- Better Auth

## Rules

- Use Bun only.
- After every code change, run:

```bash
bun run lint
bun run check-types
```

- Never run `bun run dev` or `bun run build` unless explicitly requested.
- Do not generate migration files. Use `bun db:push`.
- Do not add or update dependencies unless required.
- Follow the existing project structure.
- Make the smallest necessary change.

## Plan Mode

When asked to plan:

- Do not modify files.
- Do not write code.
- Keep the plan concise.
- End with unresolved questions, if any.
