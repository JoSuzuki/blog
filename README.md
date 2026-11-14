# JoSuzuki's blog

A bilingual (Portuguese and English) personal blog, live at https://josuzuki.me.

## What it is

[TanStack Start](https://tanstack.com/start) (React 19, Vite, TypeScript, Tailwind 4) running behind a
small custom Express 5 server (`server.js`) that also hosts socket.io. Posts are MDX files in
`content/posts`, compiled at build time; their frontmatter is validated with zod by a Vite plugin.
Comments and page-view counters live in Postgres through Prisma; a new comment is broadcast over
socket.io to everyone reading that post. Readers can sign in with Google (an ID token verified on the
server, stored in an iron-session sealed cookie), which only pre-fills the comment name. The feeds
(`/feed.xml`, `/atom.xml`, `/feed.json`) are server routes. Production runs as one container on Fly.io.

```
content/posts/   the posts (one .mdx file per post; the file name is the URL slug)
src/routes/      file-based routes, pages and feeds, with flat file names (`posts.$slug.tsx` is `/posts/$slug`)
src/components/  UI components (Tailwind utilities; tokens in src/app.css)
src/content/     post collection, frontmatter schema, MDX Vite plugins
src/lib/         actions (server functions) and what they share; see below
server/          socket.io handlers (rooms, handshake checks)
server.js        Express + socket.io + Vite (dev) or the build (production)
prisma/          schema, migrations, seed (reads backup-comments.json, backup-hits.json)
public/          fonts, images, favicon
Dockerfile, fly.toml, .github/workflows/fly-deploy.yml   deployment
```

### Loaders and actions

For someone coming from Remix or React Router 7:

- **Loader.** A route's `loader` provides its data and the component reads it with
  `Route.useLoaderData()`. Unlike in Remix it is not server-only: it runs on the server for the
  first page and in the browser on client-side navigations, so anything that needs the server goes
  through a server function. The root route loads the session (`useSession()` reads it anywhere);
  `/posts/$slug` loads the post and its comments.
- **Action.** There is no `action` export. A mutation is a server function called from the
  component (`createComment`, `login`, `logout`), followed by a reload of the loaders. That is the
  revalidation Remix does by itself after an action. A live comment arriving over socket.io does
  the same.
- **Reloading** goes through `useReload()` (`src/lib/use-reload.ts`), not `router.invalidate()`
  directly: reloads are queued and each waits for its loaders, because two started together
  discard each other's results.
- **Where latency matters** (the moves of a game) the action is a socket event instead, and its
  result is pushed rather than reloaded. See Games below.
- Not loader data: the post lists (static content bundled with the app, filtered in the browser by
  the reveal flag) and the view counter (counting is a write, done from an effect so that
  server rendering and crawlers do not count).

A server function called by a loader runs inside the page's own request during server rendering,
so a status it sets becomes the page's status. That is why `getComments` reports an unreachable
database as data, and why the post loader gives comments two seconds before rendering without them.

### `src/lib`: one action per file

Everything the browser can ask the server to do is a server function, and each one is a single file
named after it, holding the whole flow from validation to the response:

```
src/lib/comments/create-comment.ts   validate, honeypot, rate limit, store, broadcast, email
src/lib/comments/get-comments.ts
src/lib/hits/register-hit.ts
src/lib/santorini/create-room.ts     and five more, see Games below
src/lib/auth/login.ts                validate, rate limit, verify the Google token, record the user, set the session
src/lib/auth/get-session.ts
src/lib/auth/logout.ts
```

Only what more than one flow uses is a module of its own, and those are `.server.ts` files:
`rate-limit.server.ts`, `db.server.ts`, `auth/session.server.ts` (the session cookie, also read by
the socket handshake), `auth/current-user.server.ts` (the logged-in reader's `User` row),
`auth/google.server.ts` (ID token verification), `realtime/io.server.ts` (`getIO()`),
`santorini/room.server.ts`, `feeds/feeds.server.ts` (the three feed routes). `comments/comment.ts`,
`auth/session-user.ts`, `santorini/room.ts`, `santorini/game.ts` and `realtime/events.ts` are the
types, constants and rules shared with the browser.

An action file is imported by components, so it is compiled for the browser too: the compiler
replaces the handler with a request and removes what only the handler used. For that to hold, use
`.server` imports only inside the handler or in functions it calls, never at module level (for
example, no `const limiter = createRateLimiter(...)` at the top of an action; `takeRateLimit` keeps
the limiters instead). TanStack Start's import protection checks this: the build fails, and `npm run
dev` warns, if a `.server` module would reach the browser.

### Games: Santorini

`/games` lists the games; the first is Santorini, a two-player board game ported from mazeps. A
reader has to be logged in to play, since a seat in a room belongs to a `User`.

```
/games                       the list of games
/games/santorini             rooms waiting for a second player; create or join one
/games/santorini/$roomCode   one page for the room's whole life: lobby, board, result
```

- **Rules** are pure functions in `src/lib/santorini/game.ts`, used by the server to decide what
  is legal and by the board to show what can be clicked. A turn is a list of pending steps
  (select, move, build) that can be undone until it is committed.
- **A room's life is server functions**, one per file: `create-room`, `join-room`, `leave-room`,
  `start-game`, and the loaders' `get-rooms` and `get-room`. After one of them the server emits
  `santorini:changed` to the room's channel (and to `lobby` when the list changes) with no data in
  it; the pages answer by running their loader again, which is where permissions are checked.
- **The game itself is played over the socket**, for latency: a click sends `santorini:action`,
  `santorini:commit`, `santorini:undo` or `santorini:resign`, the server answers through the ack,
  and the new state is pushed to both players as `santorini:game`. Each event is still one file
  (`play-action.server.ts`, `commit-turn.server.ts`, `undo-turn.server.ts`, `resign.server.ts`):
  validate, apply the rules, write, send. `server/socket.ts` only checks who is sending and calls
  them. A move takes about 9 ms from one player's socket to the other's on a local machine, nearly
  all of it the database read and write.
- **Who gets a game's state**: every socket of a logged-in reader joins a room of its own
  (`user:<id>`) at the handshake, and updates are sent to the two players' rooms, so nobody else
  can receive them and a player's second tab stays in step. Every write checks the room's
  `updatedAt`, which doubles as the `version` a page uses to keep the newer of pushed state and
  loader data.
- **Identity on the socket** comes from the session cookie at the handshake, so login and logout
  reconnect it (`reconnectSocket`).
- What the room functions and game events share (finding the reader's seat, the guarded write,
  sending) is in `room.server.ts`.
- **The board** (`src/components/santorini/board.tsx`) is three.js through react-three-fiber. It
  is a chunk of its own (about 970 KB), fetched only by a page that shows a board and never
  rendered on the server, which is why those packages are `devDependencies`.
- **Data**: `SantoriniRoom` and `SantoriniRoomPlayer` in `prisma/schema.prisma`. The game state is
  one JSON column.

## Local development

Needs Node 22.13 or later (developed on 24) and Docker for Postgres.

```sh
npm ci                      # also generates the Prisma client (postinstall)
cp .env.sample .env         # defaults match docker-compose.yml
npm run db:up               # Postgres 15 on localhost:5433, database "blog"
npm run db:migrate          # prisma migrate deploy
npm run db:seed             # 12 comments and 15 counters from the Fauna backups; safe to re-run
npm run dev                 # http://localhost:3000 (PORT=3100 npm run dev for another port)
```

Other commands: `npm run build`, `npm start` (the production server on the build, needs `npm run
build` first), `npm run typecheck`. Always run the app through these (`server.js`); plain `vite dev`
has no socket.io. The site works without a database (posts, feeds); comments and counters then fail
quietly or show an error.

## Writing a post

Add `content/posts/<slug>.mdx`. The slug is the URL (`/posts/<slug>`) and must not change once
published. Frontmatter, all required except the last two:

```yaml
---
title: A title
description: One line, used for search and link previews
author: Jonathan Suzuki
date: 2025-01-31 # YYYY-MM-DD
tags: # optional, defaults to none
  - reflexões
secret: false # optional, defaults to false
---
```

A bad frontmatter fails `npm run build` and names the file. The post starts with its own `# Heading`
(that is the title shown on the page). Markdown with GFM (tables, strikethrough) works. Available
in MDX without imports: `<Image src width height alt />` (an `img` with a lazy loader, files under
`public/`), `<CenterImage>`, `<VideoContainer>` (wrap an `iframe`, YouTube is allowed by the CSP) and
`<Redacted redacted="real text">shown text</Redacted>` (hover or focus shows the real text only when
the reader has turned reveal on). Headings get anchor ids like the old site's.

`secret: true` hides a post from the post list, tag pages, previous/next links and the feeds, unless
the reader has turned reveal on (the secret theme sets `localStorage.redacted`). It is not access
control: the page is served at its URL to anyone who knows it, and its text is in the JavaScript
bundle. Do not put anything in a secret post that must stay private.

## Environment variables

Set in `.env` locally (git-ignored, read by `npm run dev`, `npm start` and the Prisma CLI), as Fly
secrets or `fly.toml` `[env]` in production.

| Variable                                                       | If missing                                                                                                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                 | Comments and counters do not work; the rest of the site stays up. Required by `prisma migrate deploy` and the seed.                                                                               |
| `DIRECT_URL`                                                   | `prisma migrate deploy` and `db seed` fail (the schema declares it). Same value as `DATABASE_URL` unless a pooler is in front. Not read by the running app.                                       |
| `SITE_URL`                                                     | Defaults to `https://josuzuki.me`. Must equal the public origin: it is used in the feeds and in the socket.io origin check (other origins are refused, so no live comments).                      |
| `IRON_SESSION_SECRET`                                          | 32 characters or more. Without it (or if shorter) everyone is logged out, sign-in does nothing useful, and a warning is logged at startup. Use the old site's value so existing sessions survive. |
| `GOOGLE_CLIENT_ID`                                             | Defaults to the site's existing client id. Set only to use another one.                                                                                                                           |
| `SENDGRID_API_KEY`, `COMMENT_NOTIFY_TO`, `COMMENT_NOTIFY_FROM` | All three are needed to email a notification for each comment; otherwise no email is sent.                                                                                                        |
| `COMMENT_RATE_LIMIT_MAX`, `COMMENT_RATE_LIMIT_WINDOW_SECONDS`  | 5 comments per client address per 600 seconds. The limiter is in memory, so it assumes one machine.                                                                                               |
| `PORT`                                                         | 3000.                                                                                                                                                                                             |
| `NODE_ENV`                                                     | `production` selects the built server (HTTPS redirect, CSP); `npm run dev`/`npm start` set it.                                                                                                    |

## Deployment (Fly.io)

The image (`Dockerfile`) is built in three stages: production dependencies (`npm ci --omit=dev`,
which also generates the Prisma client), a build stage (`npm ci`, `npm run build`), and the final
`node:24-alpine` image running as the `node` user with `node_modules`, `dist/`, `server.js`, `prisma/`
(schema, migrations, seed), the two backup files and the generated client. It starts with `node
server.js` (not `npm start`, so SIGTERM reaches Node; shutdown takes well under a second).

`fly.toml` (region `gru`, 512 MB shared CPU like mazeps, always-on machine, `force_https`) runs
`npx prisma migrate deploy` as the release command before each deploy and health-checks
`GET /healthz` (plain `ok`, answered before the HTTPS redirect, never touches the database). The
Prisma CLI and `tsx` are regular dependencies for that reason. There is no volume. The app assumes a
single machine (socket rooms, broadcasts and rate limits are in process memory), so deploy with
`--ha=false`. The GitHub workflow `.github/workflows/fly-deploy.yml` deploys every push to `main`; it
does nothing (the job passes with a notice) until the `FLY_API_TOKEN` repository secret exists.

`fly.toml` was written without flyctl and is not machine-validated: run `fly config validate` first.
Its `app = 'josuzuki-blog'` is a placeholder.

### Cutover checklist

Do these in order. `<app>` is the Fly app name (keep it identical in `fly.toml`).

1. Create the app without deploying: `fly apps create <app>`; if the name differs from
   `josuzuki-blog`, edit `app` in `fly.toml`. Then `fly config validate`.
2. Database. Fly Postgres or any Postgres you already have; the app needs a connection string.
   - The old site's database (the one the four 2024-08 migrations were applied to, with the `User`
     table): if it was migrated with `prisma migrate deploy` it has a `_prisma_migrations` table, and
     the release command applies only the new migration (comments and hit counters). If it was
     created some other way (`db push`, by hand), the release command fails with P3005; mark the four
     old migrations as applied once, then deploy:
     `DATABASE_URL=... DIRECT_URL=... npx prisma migrate resolve --applied <migration_name>` for
     each directory in `prisma/migrations` except `20261113062239_add_comments_and_hit_counters`.
   - A fresh database: nothing to do, all five migrations are applied by the release command.
   - On Fly Postgres: `fly postgres create`, `fly postgres attach <pg-app> -a <app>` (sets
     `DATABASE_URL`; still set `DIRECT_URL` below).
3. Secrets (use the old site's `IRON_SESSION_SECRET` from Vercel's environment variables):
   ```sh
   fly secrets set -a <app> --stage \
     DATABASE_URL='postgres://...' DIRECT_URL='postgres://...' \
     IRON_SESSION_SECRET='<the old value>'
   # optional: SENDGRID_API_KEY, COMMENT_NOTIFY_TO, COMMENT_NOTIFY_FROM, GOOGLE_CLIENT_ID
   ```
4. First deploy, one machine: `fly deploy -a <app> --ha=false`. Watch the release command; then
   `fly status -a <app>` and `fly scale count 1 -a <app>` if two machines appeared.
5. Seed once (imports the Fauna backups; idempotent, never overwrites or duplicates; counters only go
   up to the backup value): `fly ssh console -a <app> -C "npx prisma db seed"`. This relies on the
   machine's shell having the secrets in its environment (it did not get tried on Fly). If it does
   not, run the seed from a checkout through a tunnel instead:
   `fly proxy 15432:5432 -a <pg-app>` and, in another terminal,
   `DATABASE_URL=postgres://...@localhost:15432/... DIRECT_URL=<same> npm run db:seed`.
   Expect `Seeded 12 comments and 15 hit counters`.
6. Check on `https://<app>.fly.dev`: home, a post, `/tags/reflexoes`, `/feed.xml`, an unknown path
   (404), `/healthz`, posting a comment (it appears in the list), `fly logs -a <app>` without
   errors. Not expected to work there: live comments (the socket origin check compares with
   `SITE_URL`, which is `https://josuzuki.me`, so the socket is refused and the page keeps working
   without it), Google sign-in (Google only allows the origins registered for the client id), and the
   feeds point at josuzuki.me.
7. Create the deploy token and let CI take over: `fly tokens create deploy -a <app>`, add it as the
   `FLY_API_TOKEN` repository secret. From then on every push to `main` deploys.
8. Attach the domain: `fly certs add josuzuki.me -a <app>` (and `www.` if used), read the records
   from `fly certs show josuzuki.me -a <app>` and `fly ips list -a <app>`, lower the TTL at the DNS
   provider a day before, then replace the Vercel records (A/AAAA for the apex, or CNAME) with
   Fly's. Wait for `fly certs show` to report the certificate as issued. In Google Cloud Console,
   the OAuth client's authorised JavaScript origins must contain `https://josuzuki.me` (it does for
   the old site; nothing to change if the domain is the same).
9. The one thing that was never tested (no real Google credentials were available during the
   migration): on https://josuzuki.me click Login, then the Google button in the dialog and
   choose an account; expect the dialog to close and the Login button to be replaced by "Hey,
   <first name>!" (desktop width) and a "Sair" button, the comment form's name field
   pre-filled, and a `session` cookie (HttpOnly, Secure). Reload: still signed in. Click "Sair": back
   to the Login button. A user row appears in the `User` table. If the old site's cookie secret was
   reused, a session from before the move stays valid.
10. Open two browsers on the same post, post a comment in one, and expect it in the other without a
    reload (WebSocket on `/socket.io/`).
11. Retire Vercel: once DNS has moved and nothing is served from there, remove the domain from the
    Vercel project and delete the project (or pause it first for a few days as a fallback).
    Rolling back before that is a DNS change.
