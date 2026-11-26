import csv
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import export_movielens_mapping as mapping


class TestMapping(unittest.TestCase):

    def run_export(self, rows, columns=None):
        if columns is None:
            columns = ["movieId", "imdbId", "tmdbId"]

        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            input_file = folder / "links.csv"
            output_folder = folder / "output"

            with open(input_file, "w", newline="") as file:
                writer = csv.writer(file)
                writer.writerow(columns)
                writer.writerows(rows)

            with patch.object(mapping, "INPUT", input_file), \
                 patch.object(mapping, "OUTPUT", output_folder):
                mapping.export_mapping()

                with open(output_folder / "validated_mapping.csv") as file:
                    accepted = list(csv.DictReader(file))

                with open(output_folder / "rejected_mapping.csv") as file:
                    rejected = list(csv.DictReader(file))

                with open(output_folder / "mapping_report.json") as file:
                    report = json.load(file)

                first = (output_folder / "validated_mapping.csv").read_bytes()
                mapping.export_mapping()
                second = (output_folder / "validated_mapping.csv").read_bytes()

                return accepted, rejected, report, first == second

    def test_valid_id(self):
        self.assertTrue(mapping.valid_id("123"))
        self.assertFalse(mapping.valid_id(""))
        self.assertFalse(mapping.valid_id("abc"))
        self.assertFalse(mapping.valid_id("0"))
        self.assertFalse(mapping.valid_id("-5"))

    def test_valid_mappings(self):
        accepted, rejected, report, _ = self.run_export([
            [1, 100, 10], [2, 200, 20]
        ])
        self.assertEqual(len(accepted), 2)
        self.assertEqual(len(rejected), 0)
        self.assertEqual(report["coverage_percent"], 100)

    def test_missing_id(self):
        accepted, rejected, report, _ = self.run_export([
            [1, 100, 10], [2, 200, ""]
        ])
        self.assertEqual(len(accepted), 1)
        self.assertEqual(rejected[0]["reason"], "missing_id")
        self.assertEqual(report["rejected_rows"], 1)

    def test_invalid_id(self):
        accepted, rejected, _, _ = self.run_export([
            [1, 100, 10], [2, 200, "abc"]
        ])
        self.assertEqual(len(accepted), 1)
        self.assertEqual(rejected[0]["reason"], "invalid_id")

    def test_tmdb_collision(self):
        accepted, rejected, _, _ = self.run_export([
            [1, 100, 10], [2, 200, 10], [3, 300, 30]
        ])
        self.assertEqual(len(accepted), 1)
        self.assertEqual(len(rejected), 2)
        self.assertTrue(all(r["reason"] == "tmdb_collision" for r in rejected))

    def test_duplicate_movie_id(self):
        accepted, rejected, _, _ = self.run_export([
            [1, 100, 10], [1, 101, 11], [2, 200, 20]
        ])
        self.assertEqual(len(accepted), 1)
        self.assertEqual(len(rejected), 2)
        self.assertTrue(all(r["reason"] == "duplicate_movie_id" for r in rejected))

    def test_empty_file(self):
        accepted, rejected, report, _ = self.run_export([])
        self.assertEqual(len(accepted), 0)
        self.assertEqual(len(rejected), 0)
        self.assertEqual(report["coverage_percent"], 0)

    def test_repeatability(self):
        _, _, _, identical = self.run_export([
            [5, 500, 50], [1, 100, 10], [3, 300, 30]
        ])
        self.assertTrue(identical)

    def test_missing_columns(self):
        with tempfile.TemporaryDirectory() as folder:
            input_file = Path(folder) / "links.csv"
            input_file.write_text("movieId,imdbId\n1,100\n")
            with patch.object(mapping, "INPUT", input_file), \
                 patch.object(mapping, "OUTPUT", Path(folder) / "output"):
                with self.assertRaises(ValueError):
                    mapping.export_mapping()


if __name__ == "__main__":
    unittest.main()
