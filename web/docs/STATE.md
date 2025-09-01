# CulinaryBrief – Break & Resume (MVP)

## One-Command Resume
cd /workspaces/CulinaryMatrix
pnpm run pipeline
pnpm -C web dev  # open Ports → 3000 → globe
# optional: pnpm run report:serve (port 5500)

## What Works
- /planner suggestions, /list checklist (edit, duplicate, notes)
- Save/Load plans (Prisma SQLite) via /api/plans
- Data pipeline + HTML report

## Where We Paused (next picks)
- Dietary/allergen filters in planner
- Checklist polish: aisle grouping + “Hide pantry” toggle
- Export: simple PDF
- Refactor suggest/shop into importable modules for future Vercel deploy

## Versions / Paths
- Node 22, pnpm 9, Next.js 15.5 (Turbopack)
- SQLite at web/prisma/schema.prisma → file:../data/dev.db
- Key files: web/app/planner, web/app/list, web/app/api/*, web/src/lib/db.ts
