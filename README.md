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
prisma.config.ts the Prisma CLI's settings: schema path, seed command, connection URL
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

### Games: the quiz

A private party game for a group of friends: a screenshot of an old conversation is shown with the
names hidden, everyone picks on their phone who wrote each message, then the original is revealed
and scores are kept. Only readers with the role `SQUALI` or `ADMIN` (set on `/users`) can see any
of it; to everyone else its pages, images and socket events answer as if they did not exist. The
screenshots and the answers are not in this repository: they live in the database only.

```
/games/quem-disse                            the players' page (phones)
/games/quem-disse/telao                      the shared screen and the host's controls (admins)
/games/quem-disse/imagem/$printId/$kind      the images; kind is censurada or original
```

- **Playing.** An admin opens `/games/quem-disse/telao` (on the TV), chooses how many prints
  (blank: all; always in print order) and starts. Players open `/games/quem-disse`; the page follows the game by
  itself. For each print a player picks a person per slot ("Pessoa A", "Pessoa B", ...) from the
  fixed list in `src/lib/quiz/quiz.ts` and may change it until the host clicks Revelar. The reveal
  shows the original, the answers, everybody's picks and the scores (one point per right slot);
  Próximo print moves on, and after the last one (or Encerrar jogo) the final scores stay up. One
  game at a time. A player counts as taking part from their first pick.
- **Everything in a game is a socket event** (`quiz:guess`, and the host's `quiz:start`,
  `quiz:reveal`, `quiz:next`, `quiz:end`), one file each under `src/lib/quiz`, answered by an ack.
  The reader's role is read from the database for every event; the host's need `ADMIN`.
- **State is in the database** (`QuizGame`: the order, the position, the phase), so the host or a
  player can reload, or join late, and land where the game is, with their own picks restored. Each
  change pushes the whole public state (`quiz:state`) to the `user:<id>` rooms of whoever may play
  at that moment, so there is no room to remain in after a role is taken away. `version` grows
  with every write and a page keeps the newer of the pushed state and its loader data.
- **What a browser can learn before a reveal**: which print is on screen and who has answered.
  The answers and other people's picks are only put in the state once the game says the print is
  revealed. A guess and the reveal both write the game row first, so they cannot cross: after the
  reveal a guess is refused.
- **Images** are served only by the image route (`src/lib/quiz/image.server.ts`), from the bytes in
  `QuizPrintImage`: the censored one once the newest game has reached the print, the original once
  that game has revealed it, otherwise 404. Starting a new game hides every original again. All
  answers are `Cache-Control: private, no-store`, and the two images have different addresses.
- **Data**: `QuizPrint` (size, slots with the answer), `QuizPrintImage` (the bytes, in a table of
  their own so that no other query can select them), `QuizGame`, `QuizGuess`.

**Loading the prints.** `scripts/upload-quiz-prints.ts` reads a manifest (its shape is described at
the top of the script), the directory of censored images (`<id>.png`) and the directory of
originals, and upserts them by manifest id into the database `DATABASE_URL` points at. Only prints
marked `reviewed` whose slots all have a person from the game's list are uploaded; the rest are
listed with the reason. Run it again whenever the manifest or an image changes. The private
material is kept in `quiz-private/`, which is ignored by git and Docker.

```sh
# what would be uploaded, without touching the database
npm run quiz:upload -- --manifest quiz-private/manifest.json --censored quiz-private/censored \
  --originals '<the directory with the original screenshots>' --dry-run

# local database (.env); --include-proposed also takes prints not reviewed yet, for testing
npm run quiz:upload -- --manifest quiz-private/manifest.json --censored quiz-private/censored \
  --originals '<originals>' --include-proposed

# production: deploy first (the release command creates the tables), then run it from this
# checkout with the production connection string. A variable set in the shell wins over .env,
# and a database that is not on this machine needs --allow-remote. With Fly Postgres, open a
# tunnel first (`fly proxy 15432:5432 -a <pg-app>`) and use localhost:15432 in the URL.
DATABASE_URL='postgres://<user>:<password>@<host>:<port>/<database>' \
  npm run quiz:upload -- --manifest quiz-private/manifest.json --censored quiz-private/censored \
  --originals '<originals>' --allow-remote
```

A print removed from the manifest, or marked `excluded` later, is not deleted by the script:
delete its `QuizPrint` row by hand (`DELETE FROM "QuizPrint" WHERE "externalId" = '<id>'`).

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

| Variable                                                       | If missing                                                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                 | Comments and counters do not work; the rest of the site stays up. Required by `prisma migrate deploy` and the seed.                                                                                       |
| `DIRECT_URL`                                                   | What the Prisma CLI connects with (`prisma.config.ts`): `prisma migrate deploy` and `db seed`. Falls back to `DATABASE_URL`, so it is only needed when a pooler is in front. Not read by the running app. |
| `SITE_URL`                                                     | Defaults to `https://josuzuki.me`. Must equal the public origin: it is used in the feeds and in the socket.io origin check (other origins are refused, so no live comments).                              |
| `IRON_SESSION_SECRET`                                          | 32 characters or more. Without it (or if shorter) everyone is logged out, sign-in does nothing useful, and a warning is logged at startup. Changing it logs everyone out.                                 |
| `GOOGLE_CLIENT_ID`                                             | Defaults to the site's existing client id. Set only to use another one.                                                                                                                                   |
| `SENDGRID_API_KEY`, `COMMENT_NOTIFY_TO`, `COMMENT_NOTIFY_FROM` | All three are needed to email a notification for each comment; otherwise no email is sent.                                                                                                                |
| `COMMENT_RATE_LIMIT_MAX`, `COMMENT_RATE_LIMIT_WINDOW_SECONDS`  | 5 comments per client address per 600 seconds. The limiter is in memory, so it assumes one machine.                                                                                                       |
| `PORT`                                                         | 3000.                                                                                                                                                                                                     |
| `NODE_ENV`                                                     | `production` selects the built server (HTTPS redirect, CSP); `npm run dev`/`npm start` set it.                                                                                                            |

## Deployment (Fly.io)

The image (`Dockerfile`) is built in three stages: production dependencies (`npm ci --omit=dev`,
which also generates the Prisma client), a build stage (`npm ci`, `npm run build`), and the final
`node:24-alpine` image running as the `node` user with `node_modules`, `dist/`, `server.js`, `prisma/`
(schema, migrations, seed), `prisma.config.ts`, the two backup files and the generated client. It starts with `node
server.js` (not `npm start`, so SIGTERM reaches Node; shutdown takes well under a second).

`fly.toml` (region `gru`, 512 MB shared CPU like mazeps, `force_https`; the machine is suspended while nobody
is visiting and started again by the next request) runs
`npx prisma migrate deploy` as the release command before each deploy and health-checks
`GET /healthz` (plain `ok`, answered before the HTTPS redirect, never touches the database). The
Prisma CLI and `tsx` are regular dependencies for that reason. There is no volume. The app assumes a
single machine (socket rooms, broadcasts and rate limits are in process memory), so deploy with
`--ha=false`. The GitHub workflow `.github/workflows/fly-deploy.yml` deploys every push to `main`; it
does nothing (the job passes with a notice) until the `FLY_API_TOKEN` repository secret exists.

The site runs as the Fly app `josuzuki-blog` (the `app` in `fly.toml`) at https://josuzuki.me.

### Setting up a deployment from scratch

Only needed for a new app (another name, another account). `<app>` is the Fly app name; keep it
identical in `fly.toml`.

1. Create the app without deploying: `fly apps create <app>`, set `app` in `fly.toml`, then
   `fly config validate`.
2. Database: Fly Postgres or any Postgres; the app needs a connection string. On a fresh database
   the release command applies every migration. On Fly Postgres: `fly postgres create`,
   `fly postgres attach <pg-app> -a <app>` (sets `DATABASE_URL`).
3. Secrets:
   ```sh
   fly secrets set -a <app> --stage \
     DATABASE_URL='postgres://...' IRON_SESSION_SECRET='<32 or more random characters>'
   # optional: DIRECT_URL (with a pooler), SENDGRID_API_KEY, COMMENT_NOTIFY_TO,
   # COMMENT_NOTIFY_FROM, GOOGLE_CLIENT_ID
   ```
4. First deploy, one machine: `fly deploy -a <app> --ha=false`. Watch the release command; then
   `fly status -a <app>` and `fly scale count 1 -a <app>` if two machines appeared.
5. Seed once (imports the Fauna backups; idempotent, never overwrites or duplicates; counters only go
   up to the backup value): `fly ssh console -a <app> -C "npx prisma db seed"`. If that shell does
   not have the secrets in its environment, run the seed from a checkout through a tunnel instead:
   `fly proxy 15432:5432 -a <pg-app>` and, in another terminal,
   `DATABASE_URL=postgres://...@localhost:15432/... npm run db:seed`.
   Expect `Seeded 12 comments and 15 hit counters`.
6. Create the deploy token and let CI take over: `fly tokens create deploy -a <app>`, add it as the
   `FLY_API_TOKEN` repository secret. From then on every push to `main` deploys.
7. Attach the domain: `fly certs add <domain> -a <app>`, read the records from
   `fly certs show <domain> -a <app>` and `fly ips list -a <app>`, set them at the DNS provider and
   wait for `fly certs show` to report the certificate as issued. Set `SITE_URL` in `fly.toml` to
   that origin, and add it to the OAuth client's authorised JavaScript origins in Google Cloud
   Console.

### Checking a deploy

- Home, a post, `/tags/reflexoes`, `/feed.xml`, an unknown path (404), `/healthz`, and
  `fly logs -a <app>` without errors.
- Post a comment with the post open in two browsers: it appears in the other one without a reload
  (WebSocket on `/socket.io/`).
- Click Login, then the Google button, and choose an account: the dialog closes, the Login button
  is replaced by "Hey, <first name>!" (desktop width) and a "Sair" button, the comment form's name
  field is pre-filled, and there is a `session` cookie (HttpOnly, Secure). Reload: still signed in.
  "Sair" brings the Login button back.
- On `https://<app>.fly.dev` rather than the domain in `SITE_URL`, two things are expected not to
  work: live comments (the socket origin check compares with `SITE_URL`, so the socket is refused
  and the page keeps working without it) and Google sign-in (Google only allows the origins
  registered for the client id). The feeds point at `SITE_URL` too.
