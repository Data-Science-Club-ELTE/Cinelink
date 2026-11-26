# Popularity baseline (T3)

`popularity.py` recommends the same most-liked movies to every user, minus the movies
that user already rated. It is the benchmark that later graph-based models have to beat.
It uses only the Python standard library and works on Python 3.9 or later.

## Popularity measure

Computed from the **training ratings only**:

1. `score` is the number of distinct users who rated the movie at least 4.0, the like
   threshold. Change it with `--like-threshold`.
2. Ties are broken by the number of distinct users who rated the movie at all, then by
   the smaller `movieId`. The same input always gives the same ranking.

Movies that nobody liked (`score` 0) are never recommended.

## Which users get recommendations

- Every user in the training file. Movies they rated in training are skipped, including
  ones they rated low, because they have already seen them.
- With `--users-from <file>`, also every user in that file, for example the test split.
  Only the user IDs are read from it, never its ratings, so the test data cannot leak
  into the ranking. A user with no training history gets the plain popularity ranking.
- A user who has already rated almost every liked movie can get fewer than k
  recommendations. The script reports how many users this affects.

## Run it

Input is a MovieLens ratings CSV with `userId,movieId,rating` columns. Other columns,
such as `timestamp`, are ignored. Use the T1 train/test split once it is available
(issue #11); `data/processed/` is ignored by git, so the files stay local.

```bash
python3 src/recommenders/popularity.py \
  --train data/processed/train.csv \
  --users-from data/processed/test.csv \
  --k 10 \
  --out data/processed/popularity_top10.csv
```

## Output format

One row per recommendation, sorted by `userId`, then `rank`. The example rows below come
from a trial run on a random 80/20 split, so real T1 numbers will differ.

| Column | Meaning |
|---|---|
| `userId` | MovieLens user ID |
| `rank` | 1 = best |
| `movieId` | MovieLens movie ID |
| `score` | Number of training users who liked the movie |

```text
userId,rank,movieId,score
1,1,318,226
1,2,50,133
```

## Evaluate it (T4)

`load_recommendations` reads the output back as `{userId: [movieId, ...]}` in rank order,
which plugs straight into the metrics in [`src/evaluation`](../evaluation/README.md):

```python
import sys
sys.path.insert(0, "src")

from evaluation import precision_at_k
from recommenders import load_ratings, load_recommendations

recommendations = load_recommendations("data/processed/popularity_top10.csv")

# Relevant = movies a user rated >= 4 in the test split.
relevant = {}
for rating in load_ratings("data/processed/test.csv"):
    if rating.rating >= 4.0:
        relevant.setdefault(rating.user_id, set()).add(rating.movie_id)

scores = [precision_at_k(recommendations.get(u, []), movies, 10) for u, movies in relevant.items()]
print(f"Precision@10 over {len(scores)} users: {sum(scores) / len(scores):.4f}")
```

The labelling rule and the K values are T4's decision; this only shows the plumbing.

## Tests

```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```

The tests are in `tests/test_popularity_baseline.py` and use a 10-rating example worked
out by hand. They run offline in well under a second. CI runs only the pnpm checks, so it
does not run these Python tests.
