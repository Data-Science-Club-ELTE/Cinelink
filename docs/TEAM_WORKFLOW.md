# Team workflow

Use main for stable demo-ready releases, develop for shared integration, and feature/* for short tasks. Assign GitHub Issues before starting. Each PR needs one reviewer other than its author. Do not push directly to protected branches; delete feature branches after merge. These are proposed policies until a maintainer enables protection.

## Start a task

After develop has been created by an authorized maintainer:

`git switch develop`
`git pull --ff-only origin develop`
`git switch -c feature/neo4j-setup`

Other example: feature/movielens-cleaning (V2 work). Keep changes focused; never add .env.local, raw datasets or database exports.

## Commit and open a PR

Run the project checks, inspect git diff and git status. Stage explicit source paths, then git diff --cached --stat and git diff --cached. Run pnpm check:secrets. Commit with a concrete message such as "Add repeatable Neo4j seed". Push your feature branch and open a GitHub PR targeting develop. Link the assigned issue, explain behavior, list test evidence and limitations. Use the PR template.

## Review and update

The reviewer checks correctness, authorization, data handling, tests and documentation. Use concrete line comments and resolve discussions after fixes. Update the same feature branch with new commits. To incorporate develop, git fetch origin then git merge origin/develop; resolve conflicts locally, rerun checks and push. Avoid rewriting shared history.

## Merge and release

After one approval and required CI checks pass, an authorized maintainer merges the PR into develop and deletes its remote feature branch. Release/demo PRs target main from develop after a manual smoke test. Delete the local feature branch after switching away with git branch -d. Never force-push main/develop.
