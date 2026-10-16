# V1 baseline

## Actual user experience

Visitors browse/search/filter movies and see metadata/posters. Signed-in users save 0–5 ratings (zero removes a rating), bookmark movies and refresh recommendations. Account data is keyed by the session user ID. Offline seed records use placeholders; TMDB records use remote poster URLs.

## Homepage recommendation algorithm

app/api/recommendations/route.js is the main POST endpoint. Seeds are signed-in user's ratings >=3 plus bookmarks. All rated/bookmarked movies are excluded from candidates. If stored seeds are absent the request's supplied ratings can provide seeds. Genre matches are counted, sorted by overlap then TMDB voteAverage. Fallback branches use popularity, ordered by voteAverage then voteCount, and may relax selection when candidates are exhausted. Cold start uses popularity directly. If Neo4j is not configured, TMDB popular movies are available when a key exists. No learned user/movie embeddings are involved.

The separate authenticated advanced GET endpoint uses lib/advanced-recommendations.js: highly rated genres (>=4), rule-based content score weighted 0.7 and similar-user score weighted 0.3. This path is not called by the homepage and is not a trained ML model. It needs its own experiment validation. Similar-movie APIs use genre overlap. lib/recommendation-engine.js is a separate in-memory genre scorer covered by unit tests, not the production homepage ranking implementation.

## Later comparisons

Record candidate universe, data/import version, seed, split, interaction thresholds, exclusion rules and cold-start policy. Compare V1 and V2 on the same held-out users/items. Measure Precision@10, Recall@10, NDCG@10, coverage, cold-start behavior and latency. Avoid leakage across users' train/test histories. TMDB online popularity pages change and are not a reproducible research test set. Do not claim offline metrics before running experiments.

HTTP integration checks cover the main account and recommendation API journeys. They do not establish recommendation quality or exhaustive visual usability.

Ratings and bookmarks save immediately, but the homepage list remains stable until the user presses Refresh recommendations (or reloads the page).
