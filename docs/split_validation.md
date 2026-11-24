# T1 - MovieLens Train/Test Split Validation Report

## 1. Objective

The aim of this task is to split the MovieLens Latest Small ratings dataset into training and testing datasets for recommendation experiments. The split should be reproducible so that the same datasets can be used in future experiments.

## 2. Splitting Strategy

- Target train/test ratio: 80/20
- Random seed: 42

The ratings are grouped by user ID, and each user's rating indices are randomly shuffled using NumPy. Around 20% of each user's ratings are assigned to the test dataset, and the rest are assigned to the training dataset.

The number of test ratings is rounded down, with a minimum of one test rating for users with at least two ratings. If a user has only one rating, it is kept in the training dataset. This way, every user in the test dataset also appears in the training dataset.

A fixed random seed is used so that the same split can be reproduced. The original row order is preserved within each exported dataset.

## 3. Split Results

| Metric | Original | Train | Test |
|---|---:|---:|---:|
| Number of ratings | 100,836 | 80,896 | 19,940 |
| Split ratio | 100% | 80.23% | 19.77% |
| Unique users | 610 | 610 | 610 |
| Unique rated movies | 9,724 | 8,990 | 5,139 |
| Users missing from each split | — | 0 | 0 |
| Rated movies missing from each split | — | 734 | 4,585 |

The actual ratio is slightly different from 80/20 because the number of test ratings is calculated and rounded down for each user separately.

All 610 users appear in both datasets. Although some movies appear in only one of the two datasets, no ratings, users or rated movies were excluded from the split as a whole.

## 4. Validation

The script checks that the original dataset has the expected columns, contains no missing values and has no duplicate user-movie interactions. After splitting, it checks that the original ratings and timestamps are preserved and that no user-movie pair appears in both datasets.

| Validation check | Result |
|---|---|
| Missing values in original dataset | 0 |
| Duplicate user-movie interactions in original dataset | 0 |
| Consistent column names and data types | PASS |
| Overlapping user-movie interactions | 0 |
| Original rows, ratings and timestamps preserved | PASS |
| Excluded ratings | 0 |
| Excluded users | 0 |
| Excluded rated movies | 0 |
| Exported CSV files match the split DataFrames | PASS |
| Repeated splitting produces the same results | PASS |

Both datasets use the same columns and Pandas data types as the original dataset:

| Column | Data type |
|---|---|
| `userId` | `int64` |
| `movieId` | `int64` |
| `rating` | `float64` |
| `timestamp` | `int64` |

Since CSV files do not store data types, the script specifies the types when reading the files. The exported files are then loaded again and compared with the split DataFrames. The splitting function is also run twice to check that it produces the same results.

## 5. Limitations

There are 734 movies that appear only in the test dataset and 4,585 that appear only in the training dataset. Movies that appear only in the test dataset may be difficult for a recommendation model to predict ratings for, since the model has not seen any ratings for those movies during training. This is known as the item cold-start problem.

The split is random rather than based on timestamps, so it does not reflect the order in which users rated movies over time.

## 6. Reproducing the Split

The split was generated and validated using the following software versions:

- Python: 3.13.14
- Pandas: 3.1.1
- NumPy: 2.5.5

Place the original `ratings.csv` from [MovieLens Latest Small](https://grouplens.org/datasets/movielens/latest/) in `data/raw/ratings.csv`.

If Pandas and NumPy are not already installed in the Python environment, install them using:

```bash
python -m pip install pandas numpy
```

Run the script from the project root:

```bash
python scripts/train_test_split.py
```

The script generates the following files:

- `data/processed/train.csv`
- `data/processed/test.csv`

It also prints the split statistics, validation results and Python, Pandas and NumPy versions. Using the same input file (with the same row order), random seed and software environment should produce the same split.

The CSV files are kept locally and excluded from Git through the existing `.gitignore`. Only the splitting script and validation report need to be committed for this task.
