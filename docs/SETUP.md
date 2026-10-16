# Local setup

## Prerequisites and configuration

Use Node.js 22 and pnpm 8.12.1 (pinned in package.json). Run corepack enable and corepack prepare pnpm@8.12.1 --activate. Install Docker Desktop on Windows/macOS, or Docker Engine plus the Compose v2 plugin on Linux; start Docker before continuing. Git is required to clone the team repository.

From the application root run pnpm install --frozen-lockfile.

Windows PowerShell: `Copy-Item .env.example .env.local`.
macOS/Linux: `cp .env.example .env.local`.

Edit .env.local locally; never paste it into issues. Set NEO4J_PASSWORD to your own password of at least eight characters. Use NEO4J_USER=neo4j for Compose. Generate AUTH_SECRET with:

`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

Set AUTH_URL=http://127.0.0.1:3000. The application reads NEO4J_URI, NEO4J_USER (legacy NEO4J_USERNAME also supported), NEO4J_PASSWORD, TMDB_API_KEY, AUTH_SECRET and AUTH_URL. Compose reads NEO4J_PASSWORD and optional NEO4J_HTTP_PORT/NEO4J_BOLT_PORT from the same file. TMDB_IMPORT_PAGES optionally controls imports (1–5).

## Database lifecycle

Run pnpm db:up (equivalent to docker compose --env-file .env.local up -d --wait). The Neo4j 5.26 Community image uses named volumes and loopback-only host ports. No Graph Data Science plugin is required. The 5.26 tag follows patch releases within that line; use an agreed image digest if an experiment needs bit-for-bit repeatability.

Run pnpm setup-db, then pnpm seed-db. Both are repeatable: constraints use IF NOT EXISTS, seed nodes/genre relationships use MERGE. Seed properties are only assigned on creation. It never touches users or ratings. IDs -900001 through -900006 are reserved for original fictional development data. They use placeholder images intentionally.

Start pnpm dev and open http://127.0.0.1:3000. Register and sign in to use ratings/bookmarks. For production-mode local testing use pnpm build then pnpm start; do not run a build and dev server against the same .next directory simultaneously.

Shutdown: pnpm db:down. Named volumes remain. Restart: pnpm db:up. Logs: docker compose --env-file .env.local logs --tail 100 neo4j.

**Destructive reset (only your disposable Compose database):** stop the app, confirm you are in this project's root, then docker compose --env-file .env.local down --volumes. This erases that Compose project's database. Do not use it for Neo4j Desktop or data you need. Restart, setup and seed afterward. Changing NEO4J_PASSWORD does not reset a password already stored in an existing volume.

## Neo4j Desktop alternative

Start your local DBMS; copy its Bolt URI and the neo4j user's actual database password into .env.local. Skip pnpm db:up. Run setup-db and seed-db only against your intended development database. Do not run Docker and Desktop on the same host ports.

## Optional TMDB import

Get your own API key from https://www.themoviedb.org/settings/api, set TMDB_API_KEY, run pnpm import-movies. This imports one popular page (up to 20 records), merging by TMDB ID and updating metadata without overwriting users or ratings. Existing genre edges are retained; this is a development importer, not a historical metadata snapshot. Re-import does not create duplicate IDs or matching genre edges when constraints are installed. Do not share the key or redistribute poster files. Review https://developer.themoviedb.org/docs/faq and API terms before publication. TMDB attribution requirements are a public-release gate.

No key is needed for the offline seed; its posters remain placeholders. Missing Neo4j with TMDB configured supports public TMDB browsing only; ratings/accounts need Neo4j. Missing both returns empty public lists and rejects writes rather than inventing stored data.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Neo4j connection refused | Start the database, wait for healthy status, check NEO4J_URI and selected database's Bolt port. |
| Wrong password / Unauthorized | Use the database password, not a Neo4j website login. For an existing volume use its existing password or reset it through Neo4j tooling. Restart the app after edits. |
| Docker not running / not found | Install/start Docker, check docker version and docker compose version. Desktop is an alternative. |
| Port 7687/7474 occupied | Stop the other DB or set NEO4J_BOLT_PORT=7688, NEO4J_HTTP_PORT=7475 and NEO4J_URI=bolt://127.0.0.1:7688. |
| Port 3000 occupied | Stop the other server, or pnpm dev --port 3001 and set AUTH_URL accordingly. |
| Missing TMDB key | Use seed-db for offline fixtures, or obtain your own API key for import-movies. |
| No movies | Confirm the app and scripts target the same DB; run setup-db then seed-db or import-movies. Neo4j's built-in Movies example has incompatible IDs and no posters. |
| Posters missing | Seed images are placeholders. Import TMDB metadata; verify image.tmdb.org is reachable and movie imageUrl is populated. A firewall/ad blocker can block images. |
| Authentication errors | Generate AUTH_SECRET, set AUTH_URL to the exact browser origin, restart, clear stale local session cookies and sign in again. Private API requests need a session. |
| Build font download fails | The existing next/font Google integration downloads Plus Jakarta Sans during builds; allow fonts.googleapis.com/fonts.gstatic.com or use an approved locally hosted font. |
| Frozen install fails | Do not bypass silently: use the committed pnpm version, review package.json/lockfile alignment. Maintainers update both together. |

## Verification

Run pnpm lint, pnpm typecheck, pnpm test, pnpm check:secrets and pnpm build. JavaScript gets core ESLint correctness rules; TypeScript checks TS/TSX (checkJs is not enabled). Hook/style linting is not yet enforced.

With a running server, pnpm test:integration checks page responses, search/genres, image response, registration/login/logout, unauthorized writes, per-account isolation, ratings/bookmarks and personalized recommendation refresh. It uses temporary synthetic accounts on an MX-capable domain (gmail.com by default; set TEST_EMAIL_DOMAIN to override) and deletes only those accounts in finally cleanup. Existing movies/users are not deleted. TEST_BASE_URL can select another local port. Use a disposable dev database where possible.

CI runs independent checks plus a Neo4j service and fixture seed, repeatability check, production build and HTTP integration checks. A separate manual browser pass is still needed for visual behavior, keyboard navigation and mobile layout.

Type checking first generates Next.js route types with next typegen, so it also works before the first build.

Registration validates email syntax and requires DNS MX records for the domain. DNS outages produce a retryable error; no verification message is sent, so mailbox existence/ownership is not proven. Integration checks use synthetic addresses on TEST_EMAIL_DOMAIN (default gmail.com), never send mail, and delete the test accounts afterward.
