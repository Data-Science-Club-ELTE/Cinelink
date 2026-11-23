"""Popularity-based movie recommender: the baseline for later models (issue #13).

Every user gets the same ranking of movies, the most popular first, minus the movies
that user already rated in the training data.

Popularity measure (computed from training ratings only):

1. ``score``: the number of distinct users who rated the movie at least
   ``like_threshold`` (default 4.0), i.e. how many users liked it.
2. Ties are broken by the total number of distinct users who rated the movie, then by
   the smaller ``movieId``, so the ranking is fully deterministic.

Movies that nobody liked (``score == 0``) are not recommended.

Input: a MovieLens ratings CSV (``userId,movieId,rating[,timestamp]``), such as the
training split from T1. Output: a CSV with one row per recommendation,
``userId,rank,movieId,score``, sorted by ``userId`` then ``rank`` (1 = best). Use
``load_recommendations`` to read it back as ``{userId: [movieId, ...]}`` for the metrics
in ``src/evaluation``.

Command line (from the repository root):

    python3 src/recommenders/popularity.py --train data/processed/train.csv \\
        --k 10 --out data/processed/popularity_top10.csv

Add ``--users-from data/processed/test.csv`` to also recommend for users who appear
only in the test file. They have no training history, so they get the plain popularity
ranking.
"""

import argparse
import csv
import sys
from pathlib import Path
from typing import Dict, Iterable, List, NamedTuple, Optional, Sequence, Set, Tuple

DEFAULT_LIKE_THRESHOLD = 4.0
OUTPUT_COLUMNS = ["userId", "rank", "movieId", "score"]


class Rating(NamedTuple):
    user_id: int
    movie_id: int
    rating: float


class PopularityModel(NamedTuple):
    ranking: List[Tuple[int, int]]  # (movieId, score), most popular first
    seen: Dict[int, Set[int]]  # userId -> movieIds rated in training


def load_ratings(path) -> List[Rating]:
    """Read a MovieLens ratings CSV. Extra columns such as ``timestamp`` are ignored."""
    with open(path, newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = {"userId", "movieId", "rating"} - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"{path} is missing column(s): {sorted(missing)}")
        ratings = []
        for line, row in enumerate(reader, start=2):
            try:
                rating = Rating(int(row["userId"]), int(row["movieId"]), float(row["rating"]))
            except (TypeError, ValueError):
                raise ValueError(f"{path} line {line}: bad userId, movieId or rating: {row}")
            ratings.append(rating)
    return ratings


def fit_popularity(
    train: Iterable[Rating], like_threshold: float = DEFAULT_LIKE_THRESHOLD
) -> PopularityModel:
    """Rank movies by how many training users liked them (see the module docstring)."""
    likers: Dict[int, Set[int]] = {}
    raters: Dict[int, Set[int]] = {}
    seen: Dict[int, Set[int]] = {}
    for user_id, movie_id, rating in train:
        raters.setdefault(movie_id, set()).add(user_id)
        seen.setdefault(user_id, set()).add(movie_id)
        if rating >= like_threshold:
            likers.setdefault(movie_id, set()).add(user_id)
    ranked_ids = sorted(likers, key=lambda m: (-len(likers[m]), -len(raters[m]), m))
    return PopularityModel([(m, len(likers[m])) for m in ranked_ids], seen)


def recommend_popular(
    model: PopularityModel, user_ids: Iterable[int], k: int
) -> Dict[int, List[Tuple[int, int]]]:
    """Top-k ``(movieId, score)`` per user, skipping movies the user rated in training.

    A user who has rated nearly every popular movie can get fewer than k results.
    """
    if isinstance(k, bool) or not isinstance(k, int) or k < 1:
        raise ValueError(f"k must be a positive integer, got {k!r}")
    result = {}
    for user_id in sorted(set(user_ids)):
        seen = model.seen.get(user_id, set())
        top = []
        for movie_id, score in model.ranking:
            if movie_id not in seen:
                top.append((movie_id, score))
                if len(top) == k:
                    break
        result[user_id] = top
    return result


def write_recommendations(recommendations: Dict[int, List[Tuple[int, int]]], path) -> int:
    """Write ``userId,rank,movieId,score`` rows; returns the number of rows written."""
    rows = 0
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(OUTPUT_COLUMNS)
        for user_id in sorted(recommendations):
            for rank, (movie_id, score) in enumerate(recommendations[user_id], start=1):
                writer.writerow([user_id, rank, movie_id, score])
                rows += 1
    return rows


def load_recommendations(path) -> Dict[int, List[int]]:
    """Read an output CSV back as ``{userId: [movieId, ...]}`` in rank order."""
    by_user: Dict[int, List[Tuple[int, int]]] = {}
    with open(path, newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            entry = (int(row["rank"]), int(row["movieId"]))
            by_user.setdefault(int(row["userId"]), []).append(entry)
    return {user: [movie for _, movie in sorted(rows)] for user, rows in sorted(by_user.items())}


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Popularity baseline: top-k movies per user.")
    parser.add_argument("--train", required=True, help="training ratings CSV (MovieLens format)")
    parser.add_argument("--out", required=True, help="output CSV: userId,rank,movieId,score")
    parser.add_argument("--k", type=int, default=10, help="recommendations per user (default 10)")
    parser.add_argument(
        "--like-threshold",
        type=float,
        default=DEFAULT_LIKE_THRESHOLD,
        help=f"minimum rating that counts as a like (default {DEFAULT_LIKE_THRESHOLD})",
    )
    parser.add_argument(
        "--users-from",
        help="optional ratings CSV (e.g. the test split) whose users also get recommendations",
    )
    args = parser.parse_args(argv)

    try:
        train = load_ratings(args.train)
        model = fit_popularity(train, args.like_threshold)
        users = set(model.seen)
        if args.users_from:
            users |= {rating.user_id for rating in load_ratings(args.users_from)}
        recommendations = recommend_popular(model, users, args.k)
    except (OSError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    rows = write_recommendations(recommendations, args.out)
    short = sum(1 for top in recommendations.values() if len(top) < args.k)
    print(
        f"{len(train)} training ratings, {len(model.ranking)} liked movies ranked; "
        f"wrote {rows} recommendations for {len(recommendations)} users to {args.out}"
        + (f" ({short} users got fewer than {args.k})" if short else "")
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
