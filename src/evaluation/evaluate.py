
"""Offline evaluation of the CineLink popularity baseline."""

import argparse
import json
from collections import defaultdict
from pathlib import Path
from statistics import mean

from .metrics import precision_at_k, recall_at_k, ndcg_at_k
from ..recommenders.popularity import (
    load_ratings,
    fit_popularity,
    recommend_popular,
    write_recommendations,
)


def evaluate(train, test, ks=(5, 10), threshold=4.0):
    """Train on training ratings and evaluate on held-out ratings."""

    if not train or not test:
        raise ValueError("Training and test datasets must not be empty.")

    if not ks or any(type(k) is not int or k < 1 for k in ks):
        raise ValueError("K values must be positive integers.")

    # Check for train/test interaction overlap.
    train_pairs = {(r.user_id, r.movie_id) for r in train}
    test_pairs = {(r.user_id, r.movie_id) for r in test}

    overlap = train_pairs & test_pairs

    if overlap:
        raise ValueError(
            f"Data leakage: {len(overlap)} overlapping interactions."
        )

    # Train using training ratings only.
    model = fit_popularity(train, threshold)

    # Identify relevant held-out movies.
    relevant = defaultdict(set)
    test_users = {r.user_id for r in test}

    for rating in test:
        if rating.rating >= threshold:
            relevant[rating.user_id].add(rating.movie_id)

    eligible_users = sorted(relevant)

    if not eligible_users:
        raise ValueError("No users have relevant test movies.")

    # Generate recommendations without using test ratings.
    recommendations = recommend_popular(
        model, test_users, max(ks)
    )

    # Verify that no previously rated movies are recommended.
    for user_id, items in recommendations.items():
        seen = model.seen.get(user_id, set())

        if any(movie_id in seen for movie_id, _ in items):
            raise ValueError(
                f"Training movie recommended to user {user_id}."
            )

    results = {}

    for k in ks:
        precision_scores = []
        recall_scores = []
        ndcg_scores = []

        for user_id in eligible_users:
            ranked_movies = [
                movie_id
                for movie_id, _ in recommendations[user_id]
            ]

            liked_movies = relevant[user_id]

            precision_scores.append(
                precision_at_k(ranked_movies, liked_movies, k)
            )
            recall_scores.append(
                recall_at_k(ranked_movies, liked_movies, k)
            )
            ndcg_scores.append(
                ndcg_at_k(ranked_movies, liked_movies, k)
            )

        results[f"@{k}"] = {
            "precision": mean(precision_scores),
            "recall": mean(recall_scores),
            "ndcg": mean(ndcg_scores),
        }

    report = {
        "model": "popularity_baseline",
        "relevance_threshold": threshold,
        "training_ratings": len(train),
        "test_ratings": len(test),
        "training_users": len(model.seen),
        "test_users": len(test_users),
        "evaluated_users": len(eligible_users),
        "excluded_users": len(test_users) - len(eligible_users),
        "ranked_movies": len(model.ranking),
        "overlapping_interactions": len(overlap),
        "recommendation_rows": sum(
            len(items) for items in recommendations.values()
        ),
        "metrics": results,
    }

    return report, recommendations


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate the CineLink popularity baseline."
    )

    parser.add_argument(
        "--train", default="data/processed/train.csv"
    )
    parser.add_argument(
        "--test", default="data/processed/test.csv"
    )
    parser.add_argument(
        "--out", default="data/processed/evaluation_results.json"
    )
    parser.add_argument(
        "--recommendations",
        default="data/processed/popularity_top10.csv"
    )

    args = parser.parse_args()

    train = load_ratings(args.train)
    test = load_ratings(args.test)

    report, recommendations = evaluate(train, test)

    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)

    output.write_text(
        json.dumps(report, indent=4) + "\n",
        encoding="utf-8"
    )

    rec_output = Path(args.recommendations)
    rec_output.parent.mkdir(parents=True, exist_ok=True)

    write_recommendations(recommendations, rec_output)

    print(json.dumps(report, indent=4))
    print(f"\nEvaluation saved to: {output}")
    print(f"Recommendations saved to: {rec_output}")


if __name__ == "__main__":
    main()
