# anetar

## Repo structure

- `ane/` — pnpm + Turborepo monorepo (root of all work)
- `tar/` — empty, not yet started

All commands below run from `ane/`.

## ane/ monorepo

Package manager: **pnpm 11.25.0** (use `pnpm exec turbo ...`, not `npx`).
Node: **≥ 24**.

```
turbo build / turbo dev / turbo lint / turbo check-types
```

### Apps

| app | framework | dev port |
|---|---|---|
| `duye` | Vite + React 19 + Redux + Ant Design | 4242 (`strictPort`) |
| `web` | Next.js 16 | 8000 |
| `docs` | Next.js 16 | 8001 |

### Shared packages

- `@repo/ui` — reusable React components (`packages/ui/`); exports `./*` → `./src/*.tsx`, so new components in `src/` are auto-exported
- `@repo/eslint-config` — exports `./base`, `./next-js`, `./react-internal`
- `@repo/typescript-config` — shared tsconfig presets
- `duye` does **not** consume `@repo/ui` — only `web` and `docs` do

## duye (admin dashboard)

This is the primary app under active development. A few things not obvious from filenames:

- **API base URL**: set `VITE_API_BASE_URL` in a `.env` file at the app root; defaults to `/api`.
- **Auth token**: stored in `localStorage` as `token`; injected as `Authorization: Bearer <token>` by the axios interceptor.
- **UI locale**: Ant Design is configured for `zh_CN` (Chinese). User-facing text should be in Chinese.
- **Ant Design icons** are in `devDependencies`, not `dependencies`.
- **Tailwind 3** with PostCSS/Autoprefixer — custom color palette `primary.*` defined in `tailwind.config.js`.
- **TypeScript strict-ish**: `noUnusedLocals`, `noUnusedParameters`, and `verbatimModuleSyntax` are on in both `tsconfig.app.json` and `tsconfig.node.json` — use `import type` for type-only imports.
- **ESLint**: uses its own `eslint.config.js` (flat config), not the shared `@repo/eslint-config` package.
- **Redux store**: `auth`, `menu`, `header` slices; use `useAppDispatch` / `useAppSelector` from `hooks/useAuth.ts` for typed hooks.
- **API pattern**: all API calls go through `src/api/index.ts` wrapper which handles 401 auto-logout and antd error toasts. New API modules go in `src/api/modules/`.

## Verification

Run `turbo check-types` to typecheck everything. `turbo lint` for lint. No test runner is configured.
Note: `duye` has no `check-types` script — `turbo check-types` will skip it. Type errors in `duye` are only caught by `turbo build` (which runs `tsc -b`).
