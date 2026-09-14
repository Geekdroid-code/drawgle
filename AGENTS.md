# Agent Guidelines and Hard Rules

## 1. Environment and Secrets Protection (STRICT HARD RULE)

- **NEVER** view, read, open, cat, grep, search, inspect, or log any `.env`, `.env.*` files (including `.env.local`, `.env.production`, `.env.development`), secret stores, private keys, or API tokens.
- **NEVER** print, echo, or output secret credentials, API keys, service role keys, or access tokens in terminal commands, logs, artifacts, or chat responses.
- If you need to know which environment variables are used or supported by the application:
  - Inspect `.env.example` (if present) or search code references (e.g., `process.env.<VARIABLE_NAME>`).
  - Never inspect the live `.env` or `.env.local` files containing user credentials.
- Any tool call or command that attempts to read `.env` or `.env.*` is strictly prohibited.

## 2. Code Quality & Integrity Rules

- Adhere to the established TypeScript and ESLint standards (`pnpm run check`).
- Maintain existing test suites and ensure all Vitest and Node runner tests pass before concluding work.
- In PostgreSQL migrations and RPC functions, use explicit type casting when working with custom enum types (such as `public.generation_status` and `public.project_status`) inside `COALESCE` or `CASE` statements to avoid runtime type mismatch errors (e.g. error `42804`).
