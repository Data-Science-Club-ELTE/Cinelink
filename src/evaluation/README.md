# Evaluation metrics

`metrics.py` scores one user's ranked recommendations against the movies that user
actually liked. It provides Precision@K, Recall@K and NDCG@K, as listed in
[docs/EVALUATION.md](../../docs/EVALUATION.md). It uses only the Python standard library
and works on Python 3.9 or later.

| Function | Meaning |
|---|---|
| `precision_at_k(recommended, relevant, k)` | Share of the top k recommendations that are relevant: hits / k |
| `recall_at_k(recommended, relevant, k)` | Share of the relevant movies found in the top k: hits / number of relevant movies |
| `ndcg_at_k(recommended, relevant, k)` | Like recall, but hits nearer the top count more; 1.0 is a perfect ranking |

- `recommended`: movie IDs in ranked order, best first.
- `relevant`: movie IDs the user liked in the held-out data, in any order.
- `k`: a positive integer.

Use MovieLens `movieId` values in both lists, as in the MovieLens dataset. IDs are
compared with `==`, so `1` and `"1"` do not match. To show recommendations on the
website, map them to TMDB IDs afterwards with the MovieLens → TMDB mapping.

## Usage

Run this from the repository root:

```python
import sys
sys.path.insert(0, "src")

from evaluation import ndcg_at_k, precision_at_k, recall_at_k

# MovieLens movieIds: 356 Forrest Gump, 1 Toy Story, 318 Shawshank Redemption,
# 260 Star Wars: Episode IV, 593 Silence of the Lambs, 296 Pulp Fiction.
recommended = [356, 1, 318, 260, 593]
relevant = {318, 593, 296}

precision_at_k(recommended, relevant, 5)  # 0.4    (2 hits out of 5)
recall_at_k(recommended, relevant, 5)     # 0.667  (2 of the 3 liked movies found)
ndcg_at_k(recommended, relevant, 5)       # 0.416  (hits at ranks 3 and 5, not 1 and 2)
```

`python3 src/evaluation/metrics.py` prints the same example.

## Edge cases

The rules are the same for all three metrics.

| Case | Behaviour |
|---|---|
| A movie is recommended more than once | Only its first occurrence counts. Repeats are dropped before the top k are taken, so a hit is never counted twice. |
| A relevant ID appears more than once | It counts once. |
| Fewer than k recommendations | Empty positions count as misses. Precision still divides by k. |
| `recommended` is empty | Every metric returns 0.0. |
| `relevant` is empty | Every metric returns 0.0. Such users carry no signal, so leave them out before averaging over users. |
| `k` is 0, negative, a float or a bool | `ValueError` |

Relevance is binary: a movie is either relevant or not. Graded relevance (for example,
weighting a 5-star rating more than a 4-star one) is not supported.

## Tests

```bash
python3 -m unittest discover -s tests -p "test_*.py" -v
```

The tests are in `tests/test_evaluation_metrics.py`. Every expected value is worked out
by hand. They run offline in well under a second. CI currently runs only the pnpm checks,
so it does not run these Python tests.
