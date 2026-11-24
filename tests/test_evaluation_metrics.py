"""Unit tests for src/evaluation/metrics.py (issue #6).

Run from the repository root:
    python3 -m unittest discover -s tests -p "test_*.py" -v

Every expected value is worked out by hand in the comments. Movie IDs are MovieLens
movieIds; any hashable ID works the same way.
"""

import math
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from evaluation.metrics import ndcg_at_k, precision_at_k, recall_at_k  # noqa: E402

METRICS = (precision_at_k, recall_at_k, ndcg_at_k)


def gain(rank):
    """Discounted gain of one hit at a 1-based rank."""
    return 1.0 / math.log2(rank + 1)


class NormalCases(unittest.TestCase):
    # Hits at ranks 2 (20) and 5 (50); 60 is relevant but never recommended.
    RECOMMENDED = [10, 20, 30, 40, 50]
    RELEVANT = {20, 50, 60}

    def test_precision(self):
        self.assertEqual(precision_at_k(self.RECOMMENDED, self.RELEVANT, 5), 2 / 5)

    def test_recall(self):
        self.assertEqual(recall_at_k(self.RECOMMENDED, self.RELEVANT, 5), 2 / 3)

    def test_ndcg(self):
        # DCG = gain(2) + gain(5); ideal: 3 relevant movies at ranks 1-3.
        expected = (gain(2) + gain(5)) / (gain(1) + gain(2) + gain(3))
        self.assertAlmostEqual(ndcg_at_k(self.RECOMMENDED, self.RELEVANT, 5), expected)

    def test_perfect_ranking_scores_one(self):
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                self.assertEqual(metric([318, 593, 296], {296, 318, 593}, 3), 1.0)

    def test_no_hits_scores_zero(self):
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                self.assertEqual(metric([1, 2, 3], {4, 5}, 3), 0.0)

    def test_ndcg_rewards_a_hit_nearer_the_top(self):
        top = ndcg_at_k([20, 10], {20}, 2)
        second = ndcg_at_k([10, 20], {20}, 2)
        self.assertEqual(top, 1.0)
        self.assertAlmostEqual(second, gain(2))  # 1 / log2(3), about 0.631
        self.assertGreater(top, second)

    def test_relevant_order_and_container_type_do_not_matter(self):
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                expected = metric(self.RECOMMENDED, {20, 50, 60}, 5)
                self.assertEqual(metric(self.RECOMMENDED, [60, 50, 20], 5), expected)
                self.assertEqual(metric(self.RECOMMENDED, (50, 20, 60), 5), expected)

    def test_inputs_are_not_modified(self):
        recommended = [10, 20, 20, 30]
        relevant = [20, 30]
        for metric in METRICS:
            metric(recommended, relevant, 2)
        self.assertEqual(recommended, [10, 20, 20, 30])
        self.assertEqual(relevant, [20, 30])

    def test_string_ids_work_too(self):
        self.assertEqual(precision_at_k(["tt1", "tt2"], {"tt2"}, 2), 0.5)


class DifferentK(unittest.TestCase):
    RECOMMENDED = [10, 20, 30, 40, 50]
    RELEVANT = {20, 50, 60}

    def test_k_one(self):
        # Top 1 is [10]: no hit.
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                self.assertEqual(metric(self.RECOMMENDED, self.RELEVANT, 1), 0.0)

    def test_k_two(self):
        # Top 2 is [10, 20]: one hit at rank 2; ideal has 2 hits at ranks 1-2.
        self.assertEqual(precision_at_k(self.RECOMMENDED, self.RELEVANT, 2), 1 / 2)
        self.assertEqual(recall_at_k(self.RECOMMENDED, self.RELEVANT, 2), 1 / 3)
        self.assertAlmostEqual(
            ndcg_at_k(self.RECOMMENDED, self.RELEVANT, 2), gain(2) / (gain(1) + gain(2))
        )

    def test_k_larger_than_the_list_counts_empty_slots_as_misses(self):
        # One recommendation, k = 5: precision still divides by 5.
        self.assertEqual(precision_at_k([20], {20, 50}, 5), 1 / 5)
        self.assertEqual(recall_at_k([20], {20, 50}, 5), 1 / 2)
        # Ideal has both relevant movies at ranks 1-2.
        self.assertAlmostEqual(ndcg_at_k([20], {20, 50}, 5), gain(1) / (gain(1) + gain(2)))

    def test_ndcg_ideal_is_capped_at_k(self):
        # 5 relevant movies but k = 2: two hits at ranks 1-2 are already perfect.
        self.assertEqual(ndcg_at_k([1, 2], {1, 2, 3, 4, 5}, 2), 1.0)

    def test_recall_grows_and_never_exceeds_one_as_k_grows(self):
        values = [recall_at_k(self.RECOMMENDED, self.RELEVANT, k) for k in range(1, 8)]
        self.assertEqual(values, sorted(values))
        self.assertLessEqual(max(values), 1.0)


class EmptyLists(unittest.TestCase):
    def test_empty_recommendations_score_zero(self):
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                self.assertEqual(metric([], {1, 2}, 5), 0.0)

    def test_empty_relevant_scores_zero(self):
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                self.assertEqual(metric([1, 2], set(), 5), 0.0)

    def test_both_empty_score_zero(self):
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                self.assertEqual(metric([], [], 1), 0.0)


class Duplicates(unittest.TestCase):
    def test_repeated_recommendation_counts_once(self):
        # Without de-duplication the top 2 would be [20, 20]: precision 1.0, recall 2.0.
        # With it the top 2 is [20, 30]: one hit at rank 1.
        recommended = [20, 20, 30]
        self.assertEqual(precision_at_k(recommended, {20}, 2), 1 / 2)
        self.assertEqual(recall_at_k(recommended, {20}, 2), 1.0)
        self.assertEqual(ndcg_at_k(recommended, {20}, 2), 1.0)

    def test_repeats_do_not_use_up_top_k_slots(self):
        # [10, 10, 20]: the top 2 distinct movies are [10, 20], so 20 is found at rank 2.
        self.assertEqual(recall_at_k([10, 10, 20], {20}, 2), 1.0)
        self.assertAlmostEqual(ndcg_at_k([10, 10, 20], {20}, 2), gain(2))

    def test_duplicate_relevant_ids_count_once(self):
        for metric in METRICS:
            with self.subTest(metric=metric.__name__):
                self.assertEqual(
                    metric([20, 50, 70], [20, 20, 50], 3), metric([20, 50, 70], {20, 50}, 3)
                )
        self.assertEqual(recall_at_k([20, 50, 70], [20, 20, 50], 3), 1.0)


class InvalidK(unittest.TestCase):
    def test_k_must_be_a_positive_integer(self):
        for bad_k in (0, -1, 1.5, 2.0, "3", None, True):
            for metric in METRICS:
                with self.subTest(metric=metric.__name__, k=bad_k):
                    with self.assertRaises(ValueError):
                        metric([1, 2, 3], {1}, bad_k)


class Bounds(unittest.TestCase):
    def test_every_metric_stays_between_zero_and_one(self):
        rng = random.Random(6)
        for _ in range(300):
            recommended = [rng.randint(1, 30) for _ in range(rng.randint(0, 15))]
            relevant = {rng.randint(1, 30) for _ in range(rng.randint(0, 8))}
            k = rng.randint(1, 20)
            for metric in METRICS:
                value = metric(recommended, relevant, k)
                self.assertGreaterEqual(value, 0.0)
                self.assertLessEqual(value, 1.0)


if __name__ == "__main__":
    unittest.main()
