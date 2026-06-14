# 📦 Debox

**Party games for your living room.** Your phone is the controller, the TV is the
stage. No app, no accounts for players — just a room code.

Debox is a **reusable multiplayer gaming platform** (think Jackbox, built as a
product) plus a first complete game, **Phase Cards** — an original ten-phase card
climb. New games plug in as modules; the room, lobby, realtime, session and
turn systems never change.

```
Debox (platform)
 ├── Phase Cards          ← shipped
 ├── Trivia               ← drop-in later
 ├── Drawing              ← drop-in later
 └── …your game           ← one registerGame() call
```

---

## ✨ What's inside

- **Host + TV + phones.** Hosts sign in and open a room on a shared screen.
  Players join from their phones with a code or QR — anonymous, instant.
- **Server-authoritative gameplay.** Every move is validated in Convex. The
  client is never trusted; players never receive other players' hands.
- **Realtime everything.** Convex reactive queries drive the lobby, the table,
  turn changes and an animated event feed with zero polling.
- **A real game.** Phase Cards is fully playable: deal, draw, lay down sets/runs/
  colors, hit melds, freeze opponents, score rounds, climb all ten phases.
- **A premium, playful identity.** Custom design system, Framer Motion
  throughout, big-screen typography — a console party game, not a dashboard.

## 🧱 Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn-style UI, Framer Motion |
| Backend | Convex (reactive DB + serverless functions + cron + scheduler) |
| Auth (hosts only) | Clerk |
| Hosting | Vercel (web) + Convex (backend) |

## 🚀 Quickstart

```bash
# 1. Install
npm install

# 2. Start Convex (creates a dev deployment, writes NEXT_PUBLIC_CONVEX_URL)
npx convex dev          # leave running in one terminal

# 3. Configure Clerk + env  →  see docs/DEPLOYMENT.md
cp .env.example .env.local   # fill in Clerk keys + app URL

# 4. Run the app
npm run dev             # http://localhost:3000
```

Open `http://localhost:3000`, sign in as a host, create a **Phase Cards** room,
then open the join URL on a couple of phones (or browser tabs) and play.

Full setup — including the Clerk **JWT template** and the Convex dashboard
environment variables — is in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## 📜 Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run convex:dev` | Convex dev (functions + codegen, watch) |
| `npm run typecheck` | `tsc --noEmit` over app + backend |
| `npm test` | Vitest engine/game unit tests |
| `npm run lint` | ESLint (next/core-web-vitals) |
| `npm run build` | Production build |

## 🎮 Adding a new game (the whole point)

1. Implement the `GameEngine` contract (a **pure** state machine) under
   `src/lib/games/<your-game>/`.
2. Register it in `src/lib/games/index.ts`:
   ```ts
   registerGame(YourGameEngine);
   ```
3. Build a TV view + a controller view that read its public/private projections.

That's it. No changes to rooms, lobby, sessions, realtime or turns. See
**[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#game-plugin-system)** for the
contract and the reasoning.

## 📚 Docs

- **[Architecture](docs/ARCHITECTURE.md)** — engines, plugin system, data model,
  realtime, security, scalability.
- **[Deployment](docs/DEPLOYMENT.md)** — Clerk + Convex + Vercel setup, env
  vars, CI/CD secrets.

## 🪪 License

See [LICENSE](LICENSE). Phase Cards is an original game; it uses no third-party
names, art, or copy.
