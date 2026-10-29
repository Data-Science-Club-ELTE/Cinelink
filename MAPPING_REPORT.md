# MovieLens → TMDB mapping coverage

## Dataset and reproducibility

- Source: GroupLens MovieLens 20M (`ml-20m`), fixed release.
- Input files: `movies.csv` and `links.csv` from the same release.
- Record the release URL, license/README and archive SHA-256 checksum in experiment notes before publishing results.
- Raw inputs belong in ignored `data/raw/`; generated mapping and JSON report belong in ignored `data/processed/`.

## Procedure

Run from the CineLink repository root:

```bash
python scripts/map_movielens_tmdb.py "data/raw/ml-20m.zip"
```

Or pass an extracted release folder instead of the ZIP. The script joins `movies.movieId` to `links.movieId`, validates positive integer TMDB identifiers, flags missing/invalid links, duplicate MovieLens IDs, ambiguous mappings, and TMDB IDs assigned to multiple MovieLens movies. It writes a per-movie audit CSV and a summary JSON file.

**Coverage** = usable mapped movie rows / total movie rows × 100. Duplicate or ambiguous mappings are excluded from usable coverage.

## Results

Executed against the supplied `ml-20m` `movies.csv` and `links.csv` files.

| Metric | Result |
| --- | ---: |
| Movie rows | 27,278 |
| Link rows | 27,278 |
| Usable TMDB mappings | 26,991 |
| Mapping coverage | **98.95%** |
| Missing/invalid TMDB IDs | 252 |
| Movie rows with colliding TMDB IDs | 35 |
| Distinct colliding TMDB IDs | 17 |
| Duplicate movie IDs | 0 |
| Duplicate link movie IDs | 0 |
| Orphan link rows | 0 |

The 35 rows sharing 17 TMDB IDs were conservatively marked unusable pending manual review. No duplicate `movieId` values were found. This is an ID coverage audit, not an API verification that every mapped TMDB record still exists.

Reproduce with the downloaded CSVs:

```bash
python scripts/map_movielens_tmdb.py data/raw/ml-20m/movies.csv data/raw/ml-20m/links.csv
```

Or pass the `ml-20m.zip` archive as the only source argument.

## CineLink V1 integration

CineLink V1 uses TMDB identifiers for movie metadata. The mapping provides a bridge from MovieLens `movieId` to the corresponding V1 TMDB movie identifier; join against actual V1 TMDB IDs only after validating their types and uniqueness. Keep MovieLens and TMDB IDs in separate fields, and never match against V1's fictional negative development IDs or Neo4j sample graph IDs. Missing or ambiguous mappings must remain unmatched, not silently guessed. MovieLens ingestion is V2 work; this script audits mapping data and does not change the V1 database.

## Data policy

Do not commit raw MovieLens datasets or bulk derived mappings. Check the selected release's GroupLens terms and TMDB terms before redistribution. Commit only the script and this reproducibility/report template; keep generated files in ignored directories.
