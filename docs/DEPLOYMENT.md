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
- [6. Production](#6-production)
- [7. CI/CD secrets](#7-cicd-secrets)
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
some are also read inside Convex — note the duplication for `NEXT_PUBLIC_APP_URL`.

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

## 6. Production

Deploy the backend, then the frontend (the frontend depends on the backend's
schema/API being live).

### Convex (production)

```bash
npx convex deploy        # creates/updates your prod deployment
```

In the **Convex dashboard for the production deployment**, set the same backend
variables from step 4 (`CLERK_JWT_ISSUER_DOMAIN`, `GUEST_TOKEN_SECRET`,
`NEXT_PUBLIC_APP_URL` = your real domain). `npx convex deploy` prints the prod
`NEXT_PUBLIC_CONVEX_URL` — you'll need it for Vercel.

### Vercel (production)

Set these **Environment Variables** in the Vercel project:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | prod Convex URL (from `convex deploy`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `NEXT_PUBLIC_APP_URL` | your production domain, e.g. `https://debox.app` |

**Two ways to ship** — pick one:

- **Option A — GitHub Actions (this repo's `.github/workflows/ci.yml`).**
  On push to `main`: lint → typecheck → test → build → deploy Convex → deploy
  Vercel. Add the secrets in [§7](#7-cicd-secrets). Turn **off** Vercel's own Git
  auto-deploy so you don't double-deploy.

- **Option B — Vercel builds everything.** Set the Vercel **Build Command** to:
  ```
  npx convex deploy --cmd 'npm run build'
  ```
  and add `CONVEX_DEPLOY_KEY` to Vercel's env. Vercel then deploys Convex and
  builds the site on every push, and injects the right `NEXT_PUBLIC_CONVEX_URL`
  automatically. (In this mode you can drop the `deploy` job from CI and keep
  only `verify`.)

## 7. CI/CD secrets

For **Option A**, add these GitHub repository secrets (Settings → Secrets and
variables → Actions):

| Secret | Where to get it |
| --- | --- |
| `CONVEX_DEPLOY_KEY` | Convex dashboard → Settings → **Deploy keys** (production) |
| `VERCEL_TOKEN` | Vercel → Account Settings → **Tokens** |
| `VERCEL_ORG_ID` | `vercel link` then read `.vercel/project.json`, or project settings |
| `VERCEL_PROJECT_ID` | same as above |

The `verify` job needs no secrets — it builds with dummy, well-formed values.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing NEXT_PUBLIC_CONVEX_URL` | Run `npx convex dev` (writes it to `.env.local`); restart `npm run dev`. |
| Host sign-in works but Convex calls are unauthorized | The Clerk JWT template must be named `convex`, and `CLERK_JWT_ISSUER_DOMAIN` must be set **in the Convex dashboard**. |
| Share links/QR point at `localhost` in prod | Set `NEXT_PUBLIC_APP_URL` **in the Convex dashboard** (it builds the URL server-side), not just in Vercel. |
| `convex/_generated` types look stale after editing functions | Run `npx convex dev` (or `npx convex codegen` against your dev deployment) to regenerate. |
| Players can join but the game won't start | You need at least the game's `minPlayers` (Phase Cards = 2). |
| Build fails on Clerk during prerender | Ensure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is present in the build environment. |
