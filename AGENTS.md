# Destiny Bistro CRM - Agent Rules

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
- Always use pull requests targeting `develop`; do not merge directly
- Run all configured quality, security, and test checks before requesting review
- Rebase the branch against `develop` before the final push
- Assign the issue and pull request to yourself

## Commits
- Use Conventional Commits
- Only signed commits are allowed
- Keep commits small and focused on one purpose

## Branches
- Use Conventional Commit style prefixes, such as `feat/`, `fix/`, `docs/`, `test/`, `refactor/`, or `chore/`
- Use short kebab-case descriptions, such as `feat/table-order-flow`

## Testing
- Use TDD for behavior changes
- Add tests for regressions
- Use integration tests with a real isolated MySQL database for persistence and networking behavior
- Keep mobile tests focused on user flows and API tests focused on business rules
- Do not use synthetic demo fixtures as substitutes for integration tests

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
