
# MovieLens to TMDB Mapping Export

## Description

This script creates a clean one-to-one mapping between
MovieLens movie IDs and TMDB IDs.

Dataset: MovieLens Latest Small (September 2018)

## Validation

The script:
- Removes missing and invalid IDs.
- Excludes duplicate MovieLens IDs.
- Excludes conflicting TMDB IDs.
- Sorts the accepted mappings.
- Creates a report with coverage and rejection counts.

## Output Files

output/validated_mapping.csv
- movieId: positive integer, unique
- tmdbId: positive integer, unique

output/rejected_mapping.csv
- movieId
- tmdbId
- reason

output/mapping_report.json
- Total rows
- Accepted rows
- Rejected rows
- Coverage percentage
- Rejection reasons

## How to Run

Place links.csv in the data folder.

Run:

python3 scripts/export_movielens_mapping.py

## Run Tests

python3 -m unittest discover -s tests -v

## Expected Results

Total mappings: 9742
Accepted mappings: 9732
Rejected mappings: 10
Coverage: 99.90%

The results should remain identical when the script
is run again with the same input.

## Dataset

MovieLens Latest Small, GroupLens Research.
https://grouplens.org/datasets/movielens/

Raw datasets should not be committed to GitHub.
