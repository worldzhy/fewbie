# Release Checklist

Run through every step below before publishing `@devbie/fewbie-cli`. Do not skip steps for "trivial" patches.

1. `git status` — working tree is clean, all intended changes are committed.
2. Clean build: remove `dist/` and `*.tsbuildinfo`, then rebuild. Never publish from a stale `dist/`.
3. Run the full test suite; all tests pass.
4. Run `npm run check:template-sync -w @devbie/fewbie-cli`; every registry item file that also ships in fewbie-starter must be byte-identical to the template copy. Registry items and the template are two delivery channels for the same artifact (`fewbie add` vs `fewbie create`) — drift here ships a forked component. When any `@devbie/*` package was published in this release, also run `npm run check:template-sync -w @devbie/fewbie-cli -- --check-deps` and make sure the template lockfile pins the just-published versions (registry-unreachable degrades to a warning; CI runs without the flag).
5. Run `npm audit --omit=dev --workspaces` from the repo root; production dependencies must be free of known vulnerabilities. Any finding must be fixed or explicitly waived (with the reason recorded) before publishing.
6. Confirm the version bump in `package.json` follows semver relative to the actual change set (feat -> minor, fix -> patch, breaking -> major).
7. Publish with `npm publish --tag latest --otp=<code>`. Never use a `stage` dist-tag or the `npm stage` workflow.
8. After publishing, run `npm view @devbie/fewbie-cli dist-tags` to confirm `latest` points to the new version. Registry propagation can take 1-2 minutes — wait and re-check instead of re-publishing.
9. Update consuming projects' dependency version and record the change in project memory.
