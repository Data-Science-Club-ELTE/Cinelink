"""Unit tests for src/recommenders/popularity.py (issue #13).

Run from the repository root:
    python3 -m unittest discover -s tests -p "test_*.py" -v

The small training set below is worked out by hand:

    user 1: movie 10 -> 5, movie 20 -> 4, movie 30 -> 2
    user 2: movie 10 -> 4, movie 30 -> 5, movie 40 -> 4
    user 3: movie 20 -> 5, movie 30 -> 4, movie 40 -> 1
    user 4: movie 50 -> 3

Likes (rating >= 4): movie 10 by users 1, 2; movie 20 by 1, 3; movie 30 by 2, 3;
movie 40 by 2; movie 50 by nobody. Movies 10, 20 and 30 tie on 2 likes; movie 30 has
3 raters, so it comes first; 10 and 20 have 2 raters each, so the smaller ID wins.
Ranking: 30, 10, 20, 40 (scores 2, 2, 2, 1). Movie 50 is never recommended.
"""

import csv
import io
import random
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from evaluation import precision_at_k  # noqa: E402
from recommenders.popularity import (  # noqa: E402
    Rating,
    fit_popularity,
    load_ratings,
    load_recommendations,
    main,
    recommend_popular,
    write_recommendations,
)

TRAIN = [
    Rating(1, 10, 5.0),
    Rating(1, 20, 4.0),
    Rating(1, 30, 2.0),
    Rating(2, 10, 4.0),
    Rating(2, 30, 5.0),
    Rating(2, 40, 4.0),
    Rating(3, 20, 5.0),
    Rating(3, 30, 4.0),
    Rating(3, 40, 1.0),
    Rating(4, 50, 3.0),
]


def movies(top):
    return [movie_id for movie_id, _ in top]


def write_csv(path, header, rows):
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(header)
        writer.writerows(rows)


class Ranking(unittest.TestCase):
    def test_movies_are_ranked_by_likes_then_raters_then_id(self):
        model = fit_popularity(TRAIN)
        self.assertEqual(model.ranking, [(30, 2), (10, 2), (20, 2), (40, 1)])

    def test_movie_nobody_liked_is_not_ranked(self):
        self.assertNotIn(50, movies(fit_popularity(TRAIN).ranking))

    def test_like_threshold_is_configurable(self):
        # Only ratings of 5: movie 10 (user 1), 20 (user 3), 30 (user 2), one like each.
        # Tie broken by raters: 30 has 3, then 10 and 20 have 2 each.
        model = fit_popularity(TRAIN, like_threshold=5.0)
        self.assertEqual(model.ranking, [(30, 1), (10, 1), (20, 1)])

    def test_repeated_rating_row_counts_once(self):
        model = fit_popularity(TRAIN + [Rating(1, 10, 5.0), Rating(1, 40, 4.0)])
        # Movie 40 gains user 1 as a second liker; movie 10 stays at 2.
        self.assertEqual(model.ranking, [(30, 2), (40, 2), (10, 2), (20, 2)])

    def test_ranking_does_not_depend_on_input_order(self):
        expected = fit_popularity(TRAIN)
        for seed in range(5):
            shuffled = TRAIN[:]
            random.Random(seed).shuffle(shuffled)
            self.assertEqual(fit_popularity(shuffled), expected)


class Recommendations(unittest.TestCase):
    def setUp(self):
        self.model = fit_popularity(TRAIN)

    def test_seen_movies_are_excluded_even_if_rated_low(self):
        # User 1 rated 10, 20 and 30 (30 only a 2), so only 40 is left.
        self.assertEqual(movies(recommend_popular(self.model, [1], 2)[1]), [40])

    def test_each_user_gets_the_top_unseen_movies(self):
        recs = recommend_popular(self.model, [1, 2, 3, 4], 2)
        self.assertEqual(
            {user: movies(top) for user, top in recs.items()},
            {1: [40], 2: [20], 3: [10], 4: [30, 10]},
        )

    def test_scores_are_carried_into_the_output(self):
        self.assertEqual(
            recommend_popular(self.model, [4], 4)[4], [(30, 2), (10, 2), (20, 2), (40, 1)]
        )

    def test_user_without_training_history_gets_the_plain_ranking(self):
        self.assertEqual(movies(recommend_popular(self.model, [99], 3)[99]), [30, 10, 20])

    def test_never_more_than_k(self):
        for k in (1, 2, 3):
            with self.subTest(k=k):
                self.assertEqual(len(recommend_popular(self.model, [4], k)[4]), k)

    def test_duplicate_user_ids_give_one_entry(self):
        self.assertEqual(list(recommend_popular(self.model, [4, 4, 2], 1)), [2, 4])

    def test_k_must_be_a_positive_integer(self):
        for bad_k in (0, -1, 1.5, "3", None, True):
            with self.subTest(k=bad_k):
                with self.assertRaises(ValueError):
                    recommend_popular(self.model, [1], bad_k)

    def test_output_feeds_the_evaluation_metrics(self):
        # User 4 gets [30, 10]; if user 4 liked 10 in the test data, precision@2 is 1/2.
        top = movies(recommend_popular(self.model, [4], 2)[4])
        self.assertEqual(precision_at_k(top, {10}, 2), 0.5)


class Files(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write_train(self, name="train.csv"):
        path = self.dir / name
        write_csv(
            path,
            ["userId", "movieId", "rating", "timestamp"],
            [(r.user_id, r.movie_id, r.rating, 964982703) for r in TRAIN],
        )
        return path

    def test_load_ratings_reads_movielens_format(self):
        self.assertEqual(load_ratings(self.write_train()), TRAIN)

    def test_load_ratings_rejects_missing_column(self):
        path = self.dir / "bad.csv"
        write_csv(path, ["userId", "movieId"], [(1, 10)])
        with self.assertRaisesRegex(ValueError, "missing column"):
            load_ratings(path)

    def test_load_ratings_names_the_bad_line(self):
        path = self.dir / "bad.csv"
        write_csv(path, ["userId", "movieId", "rating"], [(1, 10, 4.0), (1, "x", 4.0)])
        with self.assertRaisesRegex(ValueError, "line 3"):
            load_ratings(path)

    def test_output_round_trip(self):
        recs = recommend_popular(fit_popularity(TRAIN), [4, 1], 2)
        path = self.dir / "out.csv"

        self.assertEqual(write_recommendations(recs, path), 3)
        with open(path, newline="", encoding="utf-8") as handle:
            self.assertEqual(
                list(csv.reader(handle)),
                [
                    ["userId", "rank", "movieId", "score"],
                    ["1", "1", "40", "1"],
                    ["4", "1", "30", "2"],
                    ["4", "2", "10", "2"],
                ],
            )
        self.assertEqual(load_recommendations(path), {1: [40], 4: [30, 10]})

    def test_command_line_writes_recommendations(self):
        out = self.dir / "results" / "top2.csv"
        with redirect_stdout(io.StringIO()) as printed:
            code = main(["--train", str(self.write_train()), "--k", "2", "--out", str(out)])

        self.assertEqual(code, 0)
        # 1 + 1 + 1 + 2 rows; users 1-3 have seen all but one ranked movie.
        self.assertIn("wrote 5 recommendations for 4 users", printed.getvalue())
        self.assertIn("(3 users got fewer than 2)", printed.getvalue())
        self.assertEqual(load_recommendations(out), {1: [40], 2: [20], 3: [10], 4: [30, 10]})

    def test_users_from_adds_test_only_users_without_changing_the_ranking(self):
        # The test file's ratings must not change popularity; only its user IDs are used.
        test = self.dir / "test.csv"
        write_csv(test, ["userId", "movieId", "rating"], [(7, 40, 5.0), (7, 40, 5.0), (1, 40, 5.0)])
        out = self.dir / "top2.csv"
        with redirect_stdout(io.StringIO()):
            code = main(
                ["--train", str(self.write_train()), "--users-from", str(test),
                 "--k", "2", "--out", str(out)]
            )

        self.assertEqual(code, 0)
        self.assertEqual(
            load_recommendations(out), {1: [40], 2: [20], 3: [10], 4: [30, 10], 7: [30, 10]}
        )

    def test_command_line_reports_a_missing_file(self):
        with redirect_stderr(io.StringIO()) as errors:
            code = main(["--train", str(self.dir / "nope.csv"), "--out", str(self.dir / "x.csv")])
        self.assertEqual(code, 1)
        self.assertIn("error:", errors.getvalue())


if __name__ == "__main__":
    unittest.main()
