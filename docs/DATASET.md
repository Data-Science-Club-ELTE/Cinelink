# Dataset policy

V1 uses optional TMDB API metadata and remote poster URLs, plus six original fictional development fixtures. MovieLens integration belongs to V2 and is not implemented.

Official source: https://grouplens.org/datasets/movielens/. Select a specific released version for experiments rather than silently following a changing latest snapshot. For CSV releases expect ratings.csv (userId,movieId,rating,timestamp), movies.csv (movieId,title,genres), links.csv (movieId,imdbId,tmdbId), and tags.csv when included. Archive the release README/license and a checksum in experiment notes.

MovieLens movieId is not the TMDB ID. Use links.csv, check missing tmdbId and failed/ambiguous matches, preserve original IDs and record mapping coverage. Do not treat V1's development negative IDs or the Neo4j built-in sample graph as MovieLens IDs.

Read the exact release's GroupLens usage conditions, attribution, research and redistribution restrictions before sharing derived data. Review TMDB API/image terms separately. Data access does not automatically authorize bundling images. Raw interactions may expose user activity: do not automatically commit raw datasets, personal Neo4j exports, cookies or users. Keep downloads under data/raw (ignored) and derived data under data/processed (ignored). Commit preparation code, schema, small original fixtures and reproducibility metadata, not licensed bulk inputs. See docs/EVALUATION.md.
