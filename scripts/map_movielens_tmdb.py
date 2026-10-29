#!/usr/bin/env python3
"""Audit MovieLens movieId -> TMDB tmdbId mappings.

Accepts a MovieLens release directory, ZIP archive, or two CSV files. Uses only the
movies.csv and links.csv tables, and never overwrites the raw input.
"""
import argparse
import csv
import io
import json
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile


def read_csv(source, name):
    if source.is_dir():
        paths = list(source.rglob(name))
        if len(paths) != 1:
            raise ValueError(f"Expected exactly one {name}, found {len(paths)}")
        with paths[0].open(encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))
    with ZipFile(source) as archive:
        paths = [p for p in archive.namelist() if p.endswith('/' + name) or p == name]
        if len(paths) != 1:
            raise ValueError(f"Expected exactly one {name}, found {len(paths)}")
        with archive.open(paths[0]) as raw:
            with io.TextIOWrapper(raw, encoding="utf-8-sig", newline="") as f:
                return list(csv.DictReader(f))


def clean_id(value):
    value = (value or "").strip()
    return str(int(value)) if value.isdecimal() and int(value) > 0 else ""


def audit(movies, links):
    for table, rows, required in [
        ("movies.csv", movies, {"movieId", "title", "genres"}),
        ("links.csv", links, {"movieId", "imdbId", "tmdbId"}),
    ]:
        if not rows or not required.issubset(rows[0]):
            raise ValueError(f"{table} is empty or missing columns: {sorted(required)}")

    movie_counts = Counter((r.get("movieId") or "").strip() for r in movies)
    link_groups = defaultdict(list)
    for row in links:
        link_groups[(row.get("movieId") or "").strip()].append(row)

    results = []
    for movie in movies:
        mid = (movie.get("movieId") or "").strip()
        candidates = link_groups.get(mid, [])
        ids = {clean_id(r.get("tmdbId")) for r in candidates}
        ids.discard("")
        if not mid or movie_counts[mid] > 1:
            status = "duplicate_movie_id"
        elif not candidates:
            status = "missing_link"
        elif len(ids) > 1:
            status = "ambiguous_tmdb_id"
        elif len(candidates) > 1:
            status = "duplicate_link_movie_id"
        elif not ids:
            status = "missing_or_invalid_tmdb_id"
        else:
            status = "mapped"
        results.append({"movieId": mid, "title": movie.get("title", ""),
                        "genres": movie.get("genres", ""),
                        "tmdbId": next(iter(ids)) if status == "mapped" else "",
                        "status": status})

    mapped_tmdb = defaultdict(set)
    for row in results:
        if row["status"] == "mapped":
            mapped_tmdb[row["tmdbId"]].add(row["movieId"])
    collisions = {tid: mids for tid, mids in mapped_tmdb.items() if len(mids) > 1}
    for row in results:
        if row["status"] == "mapped" and row["tmdbId"] in collisions:
            row["status"] = "duplicate_tmdb_id"
            row["tmdbId"] = ""

    counts = Counter(r["status"] for r in results)
    total = len(results)
    report = {
        "movie_rows": total,
        "link_rows": len(links),
        "usable_mappings": counts["mapped"],
        "coverage_percent": round(100 * counts["mapped"] / total, 2) if total else 0,
        "status_counts": dict(sorted(counts.items())),
        "orphan_link_rows": sum(len(v) for k, v in link_groups.items() if k not in movie_counts),
        "duplicate_movie_ids": sorted(k for k, v in movie_counts.items() if v > 1),
        "duplicate_link_movie_ids": sorted(k for k, v in link_groups.items() if len(v) > 1),
        "tmdb_id_collisions": {k: sorted(v) for k, v in sorted(collisions.items())},
    }
    return results, report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Extracted release folder, ZIP file, or movies.csv")
    parser.add_argument("links", type=Path, nargs="?", help="links.csv when source is movies.csv")
    parser.add_argument("--output", type=Path, default=Path("data/processed"))
    args = parser.parse_args()
    if not args.source.exists():
        parser.error(f"Source not found: {args.source}")
    if args.links is not None:
        if not args.links.is_file():
            parser.error(f"Links file not found: {args.links}")
        with args.source.open(encoding="utf-8-sig", newline="") as f:
            movies = list(csv.DictReader(f))
        with args.links.open(encoding="utf-8-sig", newline="") as f:
            links = list(csv.DictReader(f))
    else:
        movies = read_csv(args.source, "movies.csv")
        links = read_csv(args.source, "links.csv")
    rows, report = audit(movies, links)
    args.output.mkdir(parents=True, exist_ok=True)
    with (args.output / "movielens_tmdb_mapping.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["movieId", "title", "genres", "tmdbId", "status"])
        writer.writeheader()
        writer.writerows(rows)
    (args.output / "mapping_coverage.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Saved mapping and coverage report to {args.output}")


if __name__ == "__main__":
    main()
