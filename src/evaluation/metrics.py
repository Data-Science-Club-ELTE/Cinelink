"""Ranking metrics for movie recommendations: Precision@K, Recall@K and NDCG@K.

All three functions take the same arguments:

- ``recommended``: movie IDs in ranked order, best first (for example MovieLens
  ``movieId`` values).
- ``relevant``: movie IDs the user actually liked in the held-out data, for example
  ratings >= 4 (see docs/EVALUATION.md). Order does not matter.
- ``k``: how many of the top recommendations to evaluate. Must be a positive integer.

Relevance is binary: a movie is either relevant or not. IDs are compared with ``==``,
so ``recommended`` and ``relevant`` must use the same ID type (``1`` is not ``"1"``).

Edge cases, identical for all three metrics:

1. Duplicate recommendations: only the first occurrence of a movie counts. Repeats are
   dropped before the top K are taken, so a hit is never counted twice.
2. Duplicate relevant IDs are counted once.
3. Fewer than K recommendations: the empty positions count as misses, and
   Precision@K still divides by K, so a short list is not rewarded.
4. Empty ``recommended``: every metric is 0.0.
5. Empty ``relevant``: every metric is 0.0, because there is nothing to find. Such users
   carry no signal, so leave them out before averaging over users.
6. ``k`` that is not a positive integer (0, negative, float, bool) raises ValueError.
"""

import math
from typing import Hashable, Iterable, List, Set


def _check_k(k: int) -> None:
    if isinstance(k, bool) or not isinstance(k, int) or k < 1:
        raise ValueError(f"k must be a positive integer, got {k!r}")


def _top_k(recommended: Iterable[Hashable], k: int) -> List[Hashable]:
    """The first k distinct movie IDs, in ranked order (edge case 1)."""
    seen: Set[Hashable] = set()
    top: List[Hashable] = []
    for movie_id in recommended:
        if movie_id not in seen:
            seen.add(movie_id)
            top.append(movie_id)
            if len(top) == k:
                break
    return top


def _hits(recommended: Iterable[Hashable], relevant: Set[Hashable], k: int) -> int:
    return sum(1 for movie_id in _top_k(recommended, k) if movie_id in relevant)


def precision_at_k(
    recommended: Iterable[Hashable], relevant: Iterable[Hashable], k: int
) -> float:
    """Share of the top k recommendations that are relevant: hits / k."""
    _check_k(k)
    relevant_set = set(relevant)
    if not relevant_set:
        return 0.0
    return _hits(recommended, relevant_set, k) / k


def recall_at_k(
    recommended: Iterable[Hashable], relevant: Iterable[Hashable], k: int
) -> float:
    """Share of the relevant movies found in the top k: hits / number of relevant movies."""
    _check_k(k)
    relevant_set = set(relevant)
    if not relevant_set:
        return 0.0
    return _hits(recommended, relevant_set, k) / len(relevant_set)


def ndcg_at_k(
    recommended: Iterable[Hashable], relevant: Iterable[Hashable], k: int
) -> float:
    """Normalized discounted cumulative gain at k, with binary relevance.

    A hit at rank r (1 = top) is worth 1 / log2(r + 1), so hits near the top count more.
    The sum (DCG) is divided by the best possible DCG (IDCG): all relevant movies, up to
    k of them, placed at the top. The result is 1.0 for a perfect ranking.
    """
    _check_k(k)
    relevant_set = set(relevant)
    if not relevant_set:
        return 0.0
    dcg = sum(
        1.0 / math.log2(rank + 1)
        for rank, movie_id in enumerate(_top_k(recommended, k), start=1)
        if movie_id in relevant_set
    )
    ideal_hits = min(k, len(relevant_set))
    idcg = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_hits + 1))
    return dcg / idcg


if __name__ == "__main__":
    # Usage example with MovieLens movieIds: 1 Toy Story (1995), 260 Star Wars:
    # Episode IV (1977), 296 Pulp Fiction (1994), 318 Shawshank Redemption (1994),
    # 356 Forrest Gump (1994), 593 Silence of the Lambs (1991).
    recommended = [356, 1, 318, 260, 593]
    relevant = {318, 593, 296}
    for name, metric in (
        ("Precision@5", precision_at_k),
        ("Recall@5", recall_at_k),
        ("NDCG@5", ndcg_at_k),
    ):
        print(f"{name}: {metric(recommended, relevant, 5):.4f}")
