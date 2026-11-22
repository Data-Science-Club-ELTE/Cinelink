
# MovieLens to TMDB Mapping Report

## Dataset

MovieLens Latest Small (September 2018)
Source: GroupLens Research

Input file: links.csv

## Results

Total movies: 9742
Valid mappings: 9732
Rejected mappings: 10
Coverage: 99.90%

Rejection reasons:
- Missing TMDB IDs: 8
- Invalid IDs: 0
- TMDB collision rows: 2
- Duplicate MovieLens IDs: 0

## Known Collision

MovieLens IDs 6003 and 144606 both map to TMDB ID 4912.

Both mappings are excluded to avoid ambiguous matches.

## Output Files

validated_mapping.csv:
- movieId: positive integer, unique
- tmdbId: positive integer, unique

rejected_mapping.csv:
- movieId
- tmdbId
- reason

mapping_report.json:
- Total, accepted, and rejected rows
- Coverage percentage
- Rejection reasons

The accepted mapping is sorted by movieId.

## Reproduce

Place links.csv in the data folder.

Run:
python3 scripts/export_movielens_mapping.py

Run tests:
python3 -m unittest discover -s tests -v

## Validation

The script checks missing and invalid IDs,
duplicate MovieLens IDs, and TMDB collisions.

Accepted mappings have unique movieId and tmdbId values.
Results are sorted for consistent output.

The validation tests cover normal inputs,
invalid inputs, collisions, empty data,
missing columns, and repeatability.

## Notes

The export provides a clean mapping for future graph imports.
It does not verify live TMDB API availability.

Raw MovieLens data is not included in the GitHub submission.
