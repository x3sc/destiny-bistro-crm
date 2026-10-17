# Dependency security remediation

## Compatible updates

The security change uses npm overrides and committed lockfiles rather than
upgrading the main Expo, React Native or Prisma versions. No audit suppression,
severity reduction, renamed vulnerable package or allowlist is introduced.

| Package | Version | Reason |
| --- | --- | --- |
| mariadb | 3.5.4 | Connector memory disclosure, SQL injection and authentication crash advisories |
| fast-uri | 4.1.5 | Host normalization and mailto header validation fixes |
| shell-quote | 1.12.0 | Fix command injection affected by line terminators following comment tokens |
| source-map-js | 1.2.2 | Indexed source-map section offset denial of service fix |
| moment | 2.31.0 | Locale path traversal fix |

The existing brace-expansion 5.0.12 override is retained, with its lockfile.
The API and application business rules are not changed by these updates.

## Unresolved upstream advisories

At investigation time (2026-10-17), the following advisories list no patched
release. Updating the parent framework alone must not be claimed to resolve
these findings while the vulnerable transitive package remains installed.

- braces through 3.0.3: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- node-forge through 1.4.0: [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- sprintf-js through 1.1.3: [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c).

The frontend production audit must continue to fail if high/critical findings
remain. A published draft is not approval to merge or deploy. Do not fabricate
a patched version, bypass package integrity or hand-roll cryptographic fixes.
Resolution requires a verified upstream patch or a separately reviewed change
that removes the vulnerable dependency while preserving platform behavior.

MariaDB patch source:
[GHSA-48qf-xh34-q73r](https://github.com/advisories/GHSA-48qf-xh34-q73r).
Shell quoting patch source:
[GHSA-pqg4-j6r4-53mv](https://github.com/advisories/GHSA-pqg4-j6r4-53mv).

## Validation and rollout

Validate clean npm ci, resolved package versions, backend/frontend audits,
TypeScript, lint, unit tests and real isolated MySQL integrations. Test the
combined operational and frontend changes as well as the independent security
branch before review. Build production containers from tracked sources only.

Do not run npm ci against a live operational service. Installed modules are
updated in the validation worktree; the user's running local services remain
untouched. Restart local development with a clean dependency installation in an
approved maintenance moment. No database migration is required for this change.
