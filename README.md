# four-elements-next

Clean architecture rebuild of Four Elements RTS.

## Play

**Public URL:** https://ratoker-jpg.github.io/four-elements-next/

## Tech Stack

- TypeScript (strict mode)
- Vite
- Canvas 2D + HTML overlay UI
- Vitest (unit tests)
- Playwright (E2E tests)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Type-check and build |
| `npm run preview` | Preview production build |
| `npm run type-check` | Run TypeScript type checking |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |

## Deployment

Deployed to GitHub Pages via GitHub Actions on every push to `main`.

The workflow lives at `.github/workflows/deploy-pages.yml`.

> **One-time setup required:** Go to **Settings → Pages → Source** and select **GitHub Actions** (instead of "Deploy from a branch").
