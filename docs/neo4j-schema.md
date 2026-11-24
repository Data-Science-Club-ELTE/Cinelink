# CineLink V2 — Neo4j Graph Schema Design

**Project:** CineLink — Graph-Based Movie Recommendation System  
**Team:** Data Science Club ELTE  
**Status:** Proposed V2 design  
**Purpose:** Audit the existing Neo4j V1 database and define the graph schema needed for MovieLens-based recommendations.

---

## 1. Overview

CineLink V1 uses Neo4j to store movie information, user ratings, bookmarks, and movie genres.

CineLink V2 will extend this graph to support graph-based recommendation experiments using the MovieLens Latest Small dataset.

The V2 design must preserve the existing website functionality while allowing the team to import MovieLens ratings, connect movies to TMDB identifiers, and evaluate recommendation algorithms.

## 2. Neo4j V1 Schema Audit

### 2.1 Existing Node Types

| Node | Purpose | Important Properties |
|---|---|---|
| `User` | Registered CineLink website user | `id`, `email` |
| `Movie` | Movie available in CineLink | `id`, `title`, `synopsis`, `imageUrl`, `releaseYear`, `voteAverage`, `voteCount` |
| `Genre` | Movie genre | `name` |

The existing `Movie.id` property is used as the movie's TMDB identifier.

### 2.2 Existing Relationships

| Relationship | Direction | Purpose |
|---|---|---|
| `RATED` | `User → Movie` | Stores a user's movie rating |
| `BOOKMARKED` | `User → Movie` | Stores a user's bookmarked movies |
| `IN_GENRE` | `Movie → Genre` | Connects movies to their genres |

The `RATED` relationship stores `rating` and `timestamp` properties.

A rating value of `0` is handled by the application as removal of an existing rating rather than a stored zero-star rating.

### 2.3 Existing Constraints

The V1 database defines the following uniqueness constraints:

| Constraint | Node | Property |
|---|---|---|
| `user_id_unique` | `User` | `id` |
| `user_email_unique` | `User` | `email` |
| `movie_id_unique` | `Movie` | `id` |
| `genre_name_unique` | `Genre` | `name` |

### 2.4 Local Development Database Findings

The local V1 development database was inspected using Neo4j Desktop.

The seeded development graph contained:

- 6 fictional movie nodes
- 4 genre nodes
- 12 `IN_GENRE` relationships

These are development fixtures, not the production movie dataset.

The V1 recommendation engine primarily uses genre-weighted scoring. It does not yet implement graph embeddings or graph-based collaborative filtering.

## 3. Proposed V2 Graph Schema

V2 will retain the existing node and relationship types and introduce a separate node type for MovieLens dataset users.

### 3.1 Node Types

| Node | Important Properties | Purpose |
|---|---|---|
| `User` | `id`, `email` | Real CineLink account |
| `MovieLensUser` | `userId` | User identifier from MovieLens |
| `Movie` | `id`, `movielensId`, `title` | Movie linked to TMDB and MovieLens |
| `Genre` | `name` | Movie genre |

**Important design decision:** `User` and `MovieLensUser` must remain separate because MovieLens user IDs are dataset identifiers, not authenticated CineLink account IDs.

For mapped movies, `Movie.id` remains the TMDB identifier. The new `Movie.movielensId` property stores the corresponding MovieLens movie ID.

### 3.2 Proposed Graph Structure

```text
(:User)
   │
   ├──[:RATED {rating, timestamp}]──────┐
   │                                    │
   └──[:BOOKMARKED]──────────────────────┤
                                        ▼
                                     (:Movie)
                                        │
                                        └──[:IN_GENRE]──►(:Genre)
                                        ▲
                                        │
(:MovieLensUser)──[:RATED {rating, timestamp}]──┘
```

### 3.3 Relationship Definitions

| Source | Relationship | Target | Properties |
|---|---|---|---|
| `User` | `RATED` | `Movie` | `rating`, `timestamp` |
| `User` | `BOOKMARKED` | `Movie` | None required |
| `MovieLensUser` | `RATED` | `Movie` | `rating`, `timestamp` |
| `Movie` | `IN_GENRE` | `Genre` | None required |

The existing website relationships will remain compatible with V1.

## 4. MovieLens-to-TMDB Mapping

MovieLens Latest Small contains 9,742 movie records.

The team's mapping script was executed locally against this dataset with the following results:

| Metric | Result |
|---|---:|
| Movie rows | 9,742 |
| Link rows | 9,742 |
| Usable TMDB mappings | 9,732 |
| Mapping coverage | 99.90% |
| Missing or invalid TMDB IDs | 8 |
| Movie rows with TMDB ID collisions | 2 |
| Orphan link rows | 0 |

One collision was identified:

- TMDB ID: `4912`
- MovieLens movie IDs: `144606` and `6003`

These ambiguous rows should not be imported as uniquely mapped movies until the collision has been resolved.

The initial V2 graph import should use the **9,732 validated mappings**, subject to any further data-quality checks.

Mapping coverage does not guarantee that every movie can be fetched from the live TMDB API.

## 5. Data Integrity and Constraints

The existing V1 uniqueness constraints should remain in place.

V2 should introduce a uniqueness constraint for MovieLens users:

```cypher
CREATE CONSTRAINT movielens_user_id_unique IF NOT EXISTS
FOR (u:MovieLensUser)
REQUIRE u.userId IS UNIQUE;
```

A uniqueness constraint for mapped MovieLens movie IDs is also recommended:

```cypher
CREATE CONSTRAINT movie_movielens_id_unique IF NOT EXISTS
FOR (m:Movie)
REQUIRE m.movielensId IS UNIQUE;
```

Before adding the second constraint, verify that existing movie nodes do not contain conflicting MovieLens identifiers.

The import process should also:

- Reject missing or invalid TMDB identifiers.
- Exclude unresolved TMDB ID collisions.
- Avoid creating duplicate movie nodes.
- Use stable identifiers when merging nodes.
- Preserve existing website user ratings and bookmarks.
- Avoid treating MovieLens users as registered CineLink users.

## 6. Recommendation and Evaluation Considerations

The V2 graph will support experiments involving user–movie interactions and movie–genre relationships.

Possible recommendation approaches include:

- User–movie collaborative filtering
- Graph neighborhood similarity
- Personalized PageRank
- Graph embeddings

These are candidate approaches for future experiments, not features already implemented.

The team has implemented Precision@K, Recall@K, and NDCG@K evaluation functions.

To avoid data leakage, MovieLens interactions should be divided into training and held-out evaluation data before building the recommendation graph. Held-out interactions must not be included as recommendation-training edges.

The evaluation procedure should clearly define relevant movies, candidate movies, and the handling of users with insufficient interaction history.

## 7. Proposed Implementation Plan

### Phase 1 — Dataset Preparation

Use the validated MovieLens Latest Small mapping results and inspect missing or ambiguous identifiers.

### Phase 2 — Graph Schema Setup

Add the `MovieLensUser` node type and its uniqueness constraint while preserving the existing V1 schema.

### Phase 3 — Graph Import

Import validated movies, MovieLens users, and training-set rating relationships.

Use batched imports and idempotent `MERGE` operations where appropriate.

### Phase 4 — Graph Validation

Verify:

- Node counts and relationship counts
- Duplicate identifiers
- Missing movie references
- Rating values and timestamps
- Existing CineLink user functionality

### Phase 5 — Recommendation Experiments

Implement and compare graph-based recommendation approaches using the team's evaluation metrics.

## 8. Scope of This Pull Request

This pull request documents the V1 audit and proposes the V2 Neo4j graph schema.

**It does not:**

- Modify the production database
- Import MovieLens data
- Change existing website API routes
- Implement a recommendation algorithm

Schema implementation, data ingestion, and model experiments will be handled in subsequent development tasks.

---

## 9. Conclusion

CineLink V2 can build on the existing Neo4j database without replacing its current movie, genre, rating, or bookmark functionality.

Introducing a separate `MovieLensUser` node type and validated MovieLens-to-TMDB mappings provides a foundation for graph-based recommendation experiments while maintaining compatibility with the V1 website.