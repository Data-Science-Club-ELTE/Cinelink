# CineLink V1 architecture

Next.js App Router serves JSX pages and API routes. Client pages call same-origin APIs. Public movie/search/genre APIs read Neo4j, or selected endpoints use TMDB when no DB is configured. next/image displays remote TMDB posters; fallback artwork is local.

Auth.js v5 beta credentials in auth.js verifies bcrypt hashes, emits JWT-backed sessions, and exposes the session user ID. auth.config.js provides shared JWT-compatible configuration to middleware. Middleware protects profile/bookmarks pages; requireAuth rejects unauthenticated private API calls. There is no shared guest account for writes.

The Neo4j driver in lib/neo4j.js manages connections and transaction timeouts; Cypher values are parameterized. User nodes have unique ID/email, Movie nodes numeric IDs, Genre nodes names. RATED edges store rating/timestamp; BOOKMARKED and IN_GENRE connect users/movies/genres. setup-db installs uniqueness constraints; seeding/import is separate.

Homepage recommendations use app/api/recommendations/route.js. See V1_BASELINE.md. The separate advanced endpoint is heuristic, not ML. lib/recommendation-engine.js is a standalone genre scorer; the homepage does not call it.

Existing reusable UI includes both JS and TS variants. They are retained to avoid unnecessary migration. Application pages/routes are mostly JavaScript; TypeScript checks are not a claim that every JS path is typed. No new backend service, GDS plugin or V2 training pipeline is introduced.

V2 may add MovieLens preparation, collaborative baselines, graph representations, link prediction and evaluation as separate offline work. It is not implemented here.
