import csv
import json
from pathlib import Path
from collections import Counter

# File paths
BASE = Path(__file__).resolve().parent.parent
INPUT = BASE / "data" / "links.csv"
OUTPUT = BASE / "output"


def valid_id(value):
    value = (value or "").strip()
    return value.isascii() and value.isdecimal() and int(value) > 0


def export_mapping():
    OUTPUT.mkdir(exist_ok=True)

    with open(INPUT, "r", newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)

        if not {"movieId", "tmdbId"}.issubset(reader.fieldnames or []):
            raise ValueError("Missing required CSV columns")

        rows = list(reader)

    valid_rows = []
    rejected = []

    # Check missing and invalid IDs
    for row in rows:
        movie_id = (row["movieId"] or "").strip()
        tmdb_id = (row["tmdbId"] or "").strip()

        if not movie_id or not tmdb_id:
            rejected.append((movie_id, tmdb_id, "missing_id"))
        elif not valid_id(movie_id) or not valid_id(tmdb_id):
            rejected.append((movie_id, tmdb_id, "invalid_id"))
        else:
            valid_rows.append((int(movie_id), int(tmdb_id)))

    # Count IDs to find duplicates and collisions
    movie_counts = Counter(row[0] for row in valid_rows)
    tmdb_counts = Counter(row[1] for row in valid_rows)

    accepted = []

    for movie_id, tmdb_id in valid_rows:
        if movie_counts[movie_id] > 1:
            rejected.append((movie_id, tmdb_id, "duplicate_movie_id"))
        elif tmdb_counts[tmdb_id] > 1:
            rejected.append((movie_id, tmdb_id, "tmdb_collision"))
        else:
            accepted.append((movie_id, tmdb_id))

    # Sort results to keep the output consistent
    accepted.sort()
    rejected.sort(key=lambda row: (str(row[0]), str(row[1]), row[2]))

    # Save accepted mappings
    with open(OUTPUT / "validated_mapping.csv", "w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["movieId", "tmdbId"])
        writer.writerows(accepted)

    # Save rejected mappings
    with open(OUTPUT / "rejected_mapping.csv", "w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["movieId", "tmdbId", "reason"])
        writer.writerows(rejected)

    # Check uniqueness and row counts
    assert len(accepted) == len(set(accepted))
    assert len(accepted) == len({row[0] for row in accepted})
    assert len(accepted) == len({row[1] for row in accepted})
    assert len(accepted) + len(rejected) == len(rows)

    total = len(rows)
    coverage = round(len(accepted) / total * 100, 2) if total else 0

    report = {
        "total_rows": total,
        "accepted_rows": len(accepted),
        "rejected_rows": len(rejected),
        "coverage_percent": coverage,
        "rejection_reasons": dict(Counter(row[2] for row in rejected))
    }

    with open(OUTPUT / "mapping_report.json", "w") as file:
        json.dump(report, file, indent=4)

    print("Mapping export completed!")
    print("Accepted:", len(accepted))
    print("Rejected:", len(rejected))
    print("Coverage:", coverage, "%")


if __name__ == "__main__":
    export_mapping()
