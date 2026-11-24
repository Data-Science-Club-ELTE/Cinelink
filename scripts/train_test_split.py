"""Create and validate a deterministic per-user MovieLens ratings split."""

from pathlib import Path
import platform

import numpy as np
import pandas as pd

RANDOM_SEED = 42
TEST_RATIO = 0.2
RATING_TYPES = {
    "userId": "int64",
    "movieId": "int64",
    "rating": "float64",
    "timestamp": "int64",
}
PAIR_COLUMNS = ["userId", "movieId"]

PROJECT_ROOT = Path(__file__).resolve().parent.parent
INPUT_PATH = PROJECT_ROOT / "data" / "raw" / "ratings.csv"
OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"
TRAIN_PATH = OUTPUT_DIR / "train.csv"
TEST_PATH = OUTPUT_DIR / "test.csv"


def load_ratings(path):
    ratings = pd.read_csv(path, dtype=RATING_TYPES)

    if list(ratings.columns) != list(RATING_TYPES):
        raise ValueError("Unexpected ratings columns")
    if ratings.empty:
        raise ValueError("Ratings dataset is empty")
    if ratings.isnull().any().any():
        raise ValueError("Ratings contain missing values")
    if ratings.duplicated(subset=PAIR_COLUMNS).any():
        raise ValueError("Duplicate user-movie interactions found")

    return ratings


def split_ratings(ratings):
    rng = np.random.default_rng(RANDOM_SEED)
    train_indices = []
    test_indices = []

    for _, user_ratings in ratings.groupby("userId", sort=True):
        indices = user_ratings.index.to_numpy()
        shuffled_indices = rng.permutation(indices)
        n_ratings = len(shuffled_indices)

        if n_ratings < 2:
            train_indices.extend(shuffled_indices)
            continue

        n_test = max(1, int(n_ratings * TEST_RATIO))
        test_indices.extend(shuffled_indices[:n_test])
        train_indices.extend(shuffled_indices[n_test:])

    train = ratings.loc[train_indices].sort_index().reset_index(drop=True)
    test = ratings.loc[test_indices].sort_index().reset_index(drop=True)
    return train, test


def validate_split(ratings, train, test):
    assert train.columns.equals(ratings.columns), "Incorrect train columns"
    assert test.columns.equals(ratings.columns), "Incorrect test columns"
    assert train.dtypes.equals(ratings.dtypes), "Incorrect train data types"
    assert test.dtypes.equals(ratings.dtypes), "Incorrect test data types"

    train_pairs = set(zip(train["userId"], train["movieId"]))
    test_pairs = set(zip(test["userId"], test["movieId"]))
    overlap = train_pairs.intersection(test_pairs)
    assert not overlap, "Train and test interactions overlap"
    assert len(train) + len(test) == len(ratings), "Row count mismatch"

    combined = pd.concat([train, test], ignore_index=True)
    combined_sorted = combined.sort_values(PAIR_COLUMNS).reset_index(drop=True)
    original_sorted = ratings.sort_values(PAIR_COLUMNS).reset_index(drop=True)
    pd.testing.assert_frame_equal(combined_sorted, original_sorted, check_exact=True)

    user_counts = ratings.groupby("userId").size()
    eligible_users = set(user_counts[user_counts >= 2].index)
    assert set(train["userId"]) == set(user_counts.index), "Missing training users"
    assert set(test["userId"]) == eligible_users, "Incorrect test user coverage"

    print("Column names and data types: PASS")
    print("Overlapping user-movie interactions:", len(overlap))
    print("Original ratings and timestamps preserved: PASS")
    print("User coverage: PASS")


def report_split(ratings, train, test):
    print("\nSplit summary:")
    for name, dataset in [("Original", ratings), ("Train", train), ("Test", test)]:
        ratio = len(dataset) / len(ratings)
        print(f"{name}: {len(dataset):,} ratings ({ratio:.2%}), "
              f"{dataset['userId'].nunique():,} users, "
              f"{dataset['movieId'].nunique():,} movies")

    print("Excluded ratings:", len(ratings) - len(train) - len(test))
    for column, label in [("userId", "users"), ("movieId", "movies")]:
        original_ids = set(ratings[column])
        train_ids = set(train[column])
        test_ids = set(test[column])

        print(f"{label.capitalize()} missing from training:", len(original_ids - train_ids))
        print(f"{label.capitalize()} missing from testing:", len(original_ids - test_ids))
        print(f"Excluded {label}:", len(original_ids - (train_ids | test_ids)))


def save_split(train, test):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    train.to_csv(TRAIN_PATH, index=False, lineterminator="\n")
    test.to_csv(TEST_PATH, index=False, lineterminator="\n")
    print("\nTraining dataset saved to:", TRAIN_PATH)
    print("Testing dataset saved to:", TEST_PATH)


def validate_export(train, test):
    loaded_train = pd.read_csv(TRAIN_PATH, dtype=RATING_TYPES)
    loaded_test = pd.read_csv(TEST_PATH, dtype=RATING_TYPES)
    pd.testing.assert_frame_equal(loaded_train, train, check_exact=True)
    pd.testing.assert_frame_equal(loaded_test, test, check_exact=True)
    print("Exported dataset validation: PASS")


def validate_reproducibility(ratings, train, test):
    repeated_train, repeated_test = split_ratings(ratings)
    pd.testing.assert_frame_equal(repeated_train, train, check_exact=True)
    pd.testing.assert_frame_equal(repeated_test, test, check_exact=True)
    print("Reproducibility validation: PASS")


def main():
    print(f"Python: {platform.python_version()}")
    print(f"Pandas: {pd.__version__}")
    print(f"NumPy: {np.__version__}")
    print(f"Random seed: {RANDOM_SEED}; target test ratio: {TEST_RATIO:.0%}")

    ratings = load_ratings(INPUT_PATH)
    print("Input validation: PASS")
    train, test = split_ratings(ratings)

    validate_split(ratings, train, test)
    validate_reproducibility(ratings, train, test)
    report_split(ratings, train, test)
    save_split(train, test)
    validate_export(train, test)


if __name__ == "__main__":
    main()
