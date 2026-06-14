# Debox Deployment & Setup

Debox runs on three managed services: **Convex** (backend), **Clerk** (host
auth), and **Vercel** (web). This guide takes you from clone → local dev →
production.

- [Prerequisites](#prerequisites)
- [1. Install](#1-install)
- [2. Convex](#2-convex)
- [3. Clerk](#3-clerk)
- [4. Environment variables](#4-environment-variables)
- [5. Run locally](#5-run-locally)
- [6. Production deploys (Vercel owns it)](#6-production-deploys-vercel-owns-it)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Node.js 20+ and npm
- Free accounts on [Convex](https://convex.dev), [Clerk](https://clerk.com), and
  [Vercel](https://vercel.com)

## 1. Install

```bash
git clone <your-fork> debox && cd debox
npm install
```

## 2. Convex

```bash
npx convex dev
```

The first run logs you in, creates a **dev deployment**, regenerates
`convex/_generated`, and writes `CONVEX_DEPLOYMENT` + `NEXT_PUBLIC_CONVEX_URL`
into `.env.local`. Leave it running — it hot-reloads functions and schema.

> `convex/_generated` is committed so the app type-checks before you ever run
> Convex. `convex dev`/`convex deploy` simply regenerate identical files.

## 3. Clerk

1. Create a Clerk application. Copy the **Publishable key** and **Secret key**.
2. **Create a JWT template named exactly `convex`:**
   Clerk Dashboard → **JWT Templates** → **New template** → choose **Convex**.
   - Leave the name as `convex` (it must match `applicationID: "convex"` in
     `convex/auth.config.ts`).
   - Copy the template's **Issuer** URL (looks like
     `https://your-app.clerk.accounts.dev`). This is your
     `CLERK_JWT_ISSUER_DOMAIN`.
3. In the **Convex dashboard** (Settings → Environment Variables) add:
   - `CLERK_JWT_ISSUER_DOMAIN` = the Issuer URL from step 2.

Sign-in uses Clerk's modal / hosted Account Portal out of the box — no custom
sign-in pages required. Only `/dashboard` and `/host/*` are protected
(`middleware.ts`); everything a player touches is public.

## 4. Environment variables

Variables live in **three** places. `NEXT_PUBLIC_*` are read by the browser at
build time **and** (because `convex/rooms.ts` builds the share URL server-side)
`NEXT_PUBLIC_APP_URL` is read inside Convex.

### `.env.local` (Next.js — local dev)

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | set automatically by `convex dev` |
| `CONVEX_DEPLOYMENT` | set automatically by `convex dev` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` |

### Convex dashboard (backend runtime)

| Variable | Value |
| --- | --- |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk `convex` template Issuer URL |
| `GUEST_TOKEN_SECRET` | a long random string — `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | your app's public origin (used to build share/QR links) |

> **Don't skip `GUEST_TOKEN_SECRET` in production.** It's the server-side pepper
> that signs guest tokens. Without it the code falls back to a dev value.

See `.env.example` for the full annotated list.

## 5. Run locally

Two terminals:

```bash
npx convex dev      # terminal 1 — backend
npm run dev         # terminal 2 — web → http://localhost:3000
```

Smoke test: sign in → **New game** → **Phase Cards** → open the join URL (or QR)
in two other browser tabs/phones → enter names → **Start game**.

## 6. Production deploys (Vercel owns it)

Vercel deploys the frontend **and** the Convex backend on every production build,
via the build command in [`vercel.json`](../vercel.json):

```sh
if [ "$VERCEL_ENV" = production ]; then npx convex deploy --cmd 'npm run build'; else npm run build; fi
```

- **Production** builds run `npx convex deploy --cmd 'npm run build'`: this
  deploys Convex to your **prod** deployment, then builds the site with the prod
  `NEXT_PUBLIC_CONVEX_URL` injected automatically.
- **Preview** builds run plain `next build`, so previews never deploy to prod.

GitHub Actions (`.github/workflows/ci.yml`) is the **quality gate only** — lint ·
typecheck · test · build on every PR and push. It does not deploy, so there's no
double-deploy and no deploy secrets live in GitHub.

### One-time setup

1. **Import the repo into Vercel** (New Project → pick this repo). Vercel
   auto-detects Next.js and reads `vercel.json`.

2. **Generate a Convex *production* deploy key.** Convex dashboard → your project
   → flip the deployment selector to **Production** → **Settings → Deploy Keys** →
   **Generate Production Deploy Key**. Copy the `prod:…` value.

3. **Set Vercel environment variables** (Project → Settings → Environment
   Variables):

   | Variable | Vercel scope | Value / source |
   | --- | --- | --- |
   | `CONVEX_DEPLOY_KEY` | **Production** | the `prod:…` key from step 2 |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production (+ Preview) | Clerk publishable key |
   | `CLERK_SECRET_KEY` | Production (+ Preview) | Clerk secret key |
   | `NEXT_PUBLIC_CONVEX_URL` | **Preview** only | your *dev* Convex URL (prod is auto-injected by the build command, so leave it unset for Production) |

4. **Set the Convex *production* backend variables** — dashboard (Production
   deployment → Settings → Environment Variables) or CLI with `--prod`:

   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN "https://<app>.clerk.accounts.dev" --prod
   npx convex env set GUEST_TOKEN_SECRET "$(openssl rand -base64 48)" --prod
   npx convex env set NEXT_PUBLIC_APP_URL "https://<your-domain>" --prod
   ```

5. **Kick off the first deploy.** Run `npx convex deploy` once locally so the prod
   backend exists, then push to `main` (or click **Deploy** in Vercel). From now
   on every production build deploys both tiers.

> **Dev vs prod are separate Convex deployments** with separate URLs and separate
> env vars — set all three backend vars on the **Production** deployment, not just
> dev.

> **Clerk dev → production instance:** when you move Clerk to a production
> instance (custom domain), recreate the `convex` JWT template there, then update
> `CLERK_JWT_ISSUER_DOMAIN` (Convex prod) and the `pk_live_` / `sk_live_` keys
> (Vercel).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing NEXT_PUBLIC_CONVEX_URL` | Run `npx convex dev` (writes it to `.env.local`); restart `npm run dev`. |
| Host sign-in works but Convex calls are unauthorized | The Clerk JWT template must be named `convex`, and `CLERK_JWT_ISSUER_DOMAIN` must be set **in the Convex dashboard** (matching dev vs prod). |
| Share links/QR point at `localhost` in prod | Set `NEXT_PUBLIC_APP_URL` **on the Convex production deployment** (it builds the URL server-side). |
| Vercel production build fails at `convex deploy` | `CONVEX_DEPLOY_KEY` (a **Production** deploy key) must be set in Vercel's **Production** scope. |
| Preview deploy loads but has no backend | Set `NEXT_PUBLIC_CONVEX_URL` (your dev URL) for Vercel's **Preview** scope — previews don't deploy Convex. |
| `convex/_generated` types look stale after editing functions | Run `npx convex dev` (or `npx convex codegen`) to regenerate. |
| Players can join but the game won't start | You need at least the game's `minPlayers` (Phase Cards = 2). |
| CI build fails on Clerk during prerender | Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is present in the build environment. |
