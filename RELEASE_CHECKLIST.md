# Release Checklist

Run through every step below before publishing `@devbie/fewbie-cli`. Do not skip steps for "trivial" patches.

1. `git status` — working tree is clean, all intended changes are committed.
2. Clean build: remove `dist/` and `*.tsbuildinfo`, then rebuild. Never publish from a stale `dist/`.
3. Run the full test suite; all tests pass.
4. Confirm the version bump in `package.json` follows semver relative to the actual change set (feat -> minor, fix -> patch, breaking -> major).
5. Publish with `npm publish --tag latest --otp=<code>`. Never use a `stage` dist-tag or the `npm stage` workflow.
6. After publishing, run `npm view @devbie/fewbie-cli dist-tags` to confirm `latest` points to the new version. Registry propagation can take 1-2 minutes — wait and re-check instead of re-publishing.
7. Update consuming projects' dependency version and record the change in project memory.
