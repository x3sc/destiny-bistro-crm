# Destiny Bistro CRM - Agent Rules

## Decision Priorities
- Resolve trade-offs in this order: security, privacy, tenant isolation, authorization, auditability, and production-data preservation; functional correctness and TDD; accessible UI/UX; delivery speed and token efficiency
- Never weaken security analysis, validation, or evidence to save tokens or finish faster
- Spend additional analysis and validation when work touches authentication, authorization, tenant boundaries, payments, comandas, inventory, cancellations, audit records, migrations, dependencies, secrets, or production operations
- Prefer the least-privileged, smallest reversible change that satisfies the requirement

## Forbidden
- Direct commits to `main` or `develop`
- Force push
- Committing secrets, credentials, tokens, or `.env` files
- Skipping configured CI checks
- Touching repositories outside `x3sc/destiny-bistro-crm`
- Committing plan files; specs and ADRs are allowed
- Adding `TODO` or `HACK` comments; fix the issue or create a GitHub issue
- Mocking MySQL in integration tests for persistence behavior
- Mixing synthetic demo data with operational data
- Bypassing authentication, authorization, or audit records for comanda changes
- Adding dependencies without documenting the reason and updating the lockfile

## Workflow
- Start from `develop`, the integration branch
- Create a GitHub issue before implementation
- Create a short-lived branch from `develop`
- Keep the implementation branch local until the user has tested it and explicitly authorized publication; do not push the branch or open a pull request before that approval
- Always use pull requests targeting `develop`; do not merge directly
- Run all configured quality, security, and test checks before requesting review
- Rebase the branch against `develop` before the final push
- Assign the issue and pull request to yourself

## Security
- Treat authorization, tenant isolation, auditability, idempotency, input validation, and data integrity as acceptance criteria, not optional follow-up work
- Trace untrusted input from entry point to storage and side effects; validate at trust boundaries and avoid exposing secrets or sensitive operational data in code, logs, errors, tests, screenshots, or artifacts
- For security-sensitive changes, identify assets, actors, trust boundaries, abuse cases, failure modes, and rollback or recovery behavior before implementation
- Default to deny, least privilege, explicit authorization, scoped queries, safe retries, and auditable state transitions
- Inspect third-party skills, scripts, packages, migrations, and generated code before execution or adoption; do not bypass integrity or signature checks
- Do not run destructive production or database operations without explicit user authorization, a verified backup when applicable, and a recovery plan
- Report unresolved security risks explicitly; do not hide them behind passing functional tests

## Commits
- Use Conventional Commits
- Only signed commits are allowed
- Keep commits small and focused on one purpose

## Branches
- Use Conventional Commit style prefixes, such as `feat/`, `fix/`, `docs/`, `test/`, `refactor/`, or `chore/`
- Use short kebab-case descriptions, such as `feat/table-order-flow`

## Testing
- Use RED -> GREEN -> REFACTOR for behavior changes
- RED: add the smallest test that demonstrates the missing or incorrect behavior before changing production code; if an existing test already proves it, do not create a duplicate
- Confirm that RED fails for the expected reason, not because of unrelated environment or fixture failures
- GREEN: implement only what is necessary to pass the relevant test; REFACTOR only while keeping the relevant tests green
- Add regression tests for defects, security boundaries, authorization, tenant isolation, idempotency, payments, inventory, cancellations, and audit behavior when affected
- Use integration tests with a real isolated MySQL database for persistence and networking behavior
- Keep mobile tests focused on user flows and API tests focused on business rules
- Do not use synthetic demo fixtures as substitutes for integration tests
- Run the narrowest relevant test first, then expand validation according to the changed dependency and risk surface
- Before rerunning a test or check, inspect the current diff and prior result. Reuse a prior result only when it was produced after the latest relevant change and no covered code, dependency, lockfile, schema, migration, configuration, fixture, or environment changed
- Do not rerun an unchanged test merely to reproduce identical evidence, but rerun every affected test after a relevant change; never claim a stale result as current
- Record the exact command, scope, outcome, and relevant code state for reusable test evidence
- Before requesting review or publication, run all configured quality, security, and test checks even if narrower checks passed during iteration
- If the user explicitly asks to run tests themselves, do not execute them; provide the exact Windows PowerShell command and wait for the returned output

## UI/UX
- For new interfaces or substantial visual redesigns, invoke `$frontend-design` before implementation; do not load it for backend-only or non-visual changes
- Preserve established product behavior and design-system conventions unless the task explicitly changes them
- Prefer clear information hierarchy, deliberate typography and spacing, accessible contrast, visible focus, keyboard navigation, reduced-motion support, and responsive layouts
- Treat loading, empty, validation, error, offline, success, disabled, and destructive-confirmation states as part of the feature
- Keep interface copy specific, concise, consistent, and action-oriented; never rely on color alone to communicate state
- After changing a runnable web interface, invoke `$webapp-testing` only for affected high-value flows, after relevant unit and integration tests pass
- Use screenshots and browser evidence to validate meaningful visual states and failures; do not test the entire application when the changed risk surface is narrower

## Context and Token Efficiency
- Token efficiency is subordinate to security, correctness, TDD, and UI/UX quality
- Search with `rg` before opening files; read the smallest relevant ranges and avoid reopening unchanged content already established in the current session
- Prefer repository scripts and focused commands over loading large implementations or printing full logs; summarize repetitive output while preserving actionable errors and evidence
- Reuse valid decisions, test results, and artifacts from the current task instead of regenerating them; revalidate whenever their assumptions may have changed
- Load optional skills only when their scope matches the task
- Keep progress updates concise and do not repeat settled context
- When the context becomes large or work must continue in another session, recommend explicit `$handoff` with the next session's objective; do not create handoffs for small tasks or invoke it implicitly

## Code
- Use TypeScript in strict mode
- Keep the mobile app based on React Native with Expo
- Keep the API based on Node.js, Fastify, Prisma, and MySQL
- Keep shared API contracts explicit and versioned with the code
- Store monetary values as integer cents; format BRL only at presentation boundaries
- Preserve auditability for table, comanda, order, cancellation, and closing actions
- Keep demo mode local, clearly identified, and isolated from operational API calls
- Avoid premature abstractions and keep each incremental delivery small

## Documentation
- Specs: `docs/specs/`
- ADRs: `docs/adrs/`
- Plans: never commit
- Update the README when setup instructions or delivered capabilities change
