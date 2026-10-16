# Evaluation plan (planned)

1. Pin a fixed MovieLens dataset and preprocessing version.
2. Define relevant interactions (e.g. ratings >= 4) and candidate universe.
3. Split by time where practical, with a separate validation set and final held-out test set.
4. Fit all preprocessing, graph structure, embeddings and models using training data only. Avoid leakage from held-out edges.
5. Compare popularity, existing genre recommender, collaborative filtering, graph embeddings/link prediction and hybrid ranking under the same evaluation protocol.
6. Report Precision@10, Recall@10, NDCG@10, catalog coverage, cold-start performance and runtime where feasible.
7. Distinguish unobserved interactions from explicit negative feedback; document negative sampling and evaluation assumptions.

No results have been measured yet.
