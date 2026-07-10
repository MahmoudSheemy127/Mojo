# Command: Create Automated Draft Pull Request

## Objective
Analyze the current git workspace changes against the base branch, compile a comprehensive Pull Request description using the repository's standard template, and programmatically publish a Draft PR using the designated git remote.

## Configuration & Variables
- **Target Remote/Workspace (`$1`):** Defaults to `origin` if unspecfied. If the user passes an argument (e.g., `mojo`), bind that value to `<git_remote>` and use it for all remote git operations.
- **Base Branch:** `main` (or default integration branch)
- **Target Branch:** The current local active branch
- **PR Template Path:** `.github/pull_request_template.md`
- **Issue Reference:** [Agent: Extract from current branch name or prompt context, e.g., #104]

## Execution Steps

### Step 1: Analyze Changes
1. Inspect the template layout at `.github/pull_request_template.md`.
2. Execute an up-to-date git diff check against the selected remote target (`git diff <git_remote>/main...HEAD`) to capture all modifications, additions, and structural shifts in this branch.

### Step 2: Draft the Description
Synthesize the git diff data to fill out every section of the markdown template:
- **Description:** Provide a technical overview of *what* was changed and *why*.
- **Related Issues:** Insert the tracking keyword (`Closes #<issue_number>`).
- **Type of Change:** Check the appropriate box (`[x]`).
- **How Has This Been Verified:** Dynamically generate the exact local testing steps or commands required to verify these specific code changes.

### Step 3: Publish the PR
1. Generate a structured title conforming to the **Conventional Commits** specification (e.g., `feat(auth): ...`, `fix(db): ...`, `refactor(core): ...`).
2. Write the compiled markdown body to a temporary tracking file.
3. Explicitly push the local branch HEAD to the targeted remote workspace:
   ```bash
   git push -u <git_remote> HEAD