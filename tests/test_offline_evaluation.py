
import unittest

from src.evaluation.evaluate import evaluate
from src.recommenders.popularity import Rating


class OfflineEvaluationTests(unittest.TestCase):

    def setUp(self):
        self.train = [
            Rating(1, 10, 5.0),
            Rating(2, 20, 5.0),
            Rating(3, 20, 4.0),
        ]

        self.test = [
            Rating(1, 20, 5.0),
            Rating(2, 10, 2.0),
        ]

    def test_correct_metrics(self):
        report, _ = evaluate(
            self.train, self.test, ks=(1,)
        )

        self.assertAlmostEqual(
            report["metrics"]["@1"]["precision"], 1.0
        )
        self.assertAlmostEqual(
            report["metrics"]["@1"]["recall"], 1.0
        )
        self.assertAlmostEqual(
            report["metrics"]["@1"]["ndcg"], 1.0
        )

    def test_users_without_relevant_movies_excluded(self):
        report, _ = evaluate(self.train, self.test)

        self.assertEqual(report["test_users"], 2)
        self.assertEqual(report["evaluated_users"], 1)
        self.assertEqual(report["excluded_users"], 1)

    def test_overlap_is_rejected(self):
        test = [Rating(1, 10, 5.0)]

        with self.assertRaises(ValueError):
            evaluate(self.train, test)

    def test_seen_movies_are_not_recommended(self):
        _, recommendations = evaluate(
            self.train, self.test
        )

        self.assertNotIn(
            10, [movie for movie, _ in recommendations[1]]
        )
        self.assertNotIn(
            20, [movie for movie, _ in recommendations[2]]
        )

    def test_metrics_are_bounded(self):
        report, _ = evaluate(self.train, self.test)

        for metrics in report["metrics"].values():
            for value in metrics.values():
                self.assertGreaterEqual(value, 0.0)
                self.assertLessEqual(value, 1.0)

    def test_empty_test_is_rejected(self):
        with self.assertRaises(ValueError):
            evaluate(self.train, [])

    def test_test_ratings_do_not_change_recommendations(self):
        _, first = evaluate(self.train, self.test)

        changed_test = [
            Rating(1, 20, 4.0),
            Rating(2, 10, 5.0),
        ]

        _, second = evaluate(self.train, changed_test)

        self.assertEqual(first, second)

    def test_no_relevant_users_is_rejected(self):
        with self.assertRaises(ValueError):
            evaluate(self.train, [Rating(1, 20, 2.0)])


if __name__ == "__main__":
    unittest.main()
