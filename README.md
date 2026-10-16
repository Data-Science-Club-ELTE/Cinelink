# CineLink

A movie recommendation app for the ELTE Data Science Club, formerly MovieRec.

V1 includes movie browsing/search, TMDB posters, accounts, ratings, bookmarks and genre-based recommendations. MovieLens ingestion, graph embeddings and model training are planned V2 work.

## Run locally

Prerequisites: Node.js 22, pnpm 8.12.1 and Docker Compose v2 (or Neo4j Desktop).

1. Clone this repository and enter the folder containing package.json.
2. Run `corepack enable`, then `corepack prepare pnpm@8.12.1 --activate`.
3. Run `pnpm install --frozen-lockfile`.
4. Copy `.env.example` to `.env.local`. Set your database password and a random AUTH_SECRET as described in [setup](docs/SETUP.md).
5. Run `pnpm db:up`, `pnpm setup-db`, then `pnpm seed-db`. Skip db:up if using Neo4j Desktop.
6. Run `pnpm dev` and open http://127.0.0.1:3000.

The offline seed contains six original fictional movies with placeholder images. For real movie posters, set your own TMDB_API_KEY and run `pnpm import-movies`. No credentials or poster files are bundled.

## Checks

Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check:secrets` and `pnpm build`. With a running configured app/database, run `pnpm test:integration`.

## Team documentation

- [Setup and troubleshooting](docs/SETUP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Recommendation baseline](docs/V1_BASELINE.md)
- [Contribution workflow](docs/TEAM_WORKFLOW.md)
- [Dataset policy](docs/DATASET.md) and [evaluation plan](docs/EVALUATION.md)
- [Security](docs/SECURITY.md)

## Current limitations

Docker startup has not been tested in the preparation environment. Auth.js remains a beta. Email-domain checks do not prove mailbox ownership. Three Tailwind build-tool dependency advisories remain; see the security document. Complete a manual browser/mobile smoke test before a public release and review TMDB attribution requirements.
