# Coding Standards — GymPro Gym Management System

> **Scope:** All TypeScript code (frontend and backend) in this repository.
> **Companion:** See [NAMING_CONVENTION.md](./NAMING_CONVENTION.md) for the full naming reference.

---

## 1. Language

- **TypeScript 5.9** with **strict mode** enabled (`"strict": true` in `tsconfig.json`).
- Both frontend (React) and backend (Node.js / Express) use a single language and share the same rule set.
- No plain JavaScript files (`.js`, `.jsx`) without explicit exception approval.

---

## 2. Formatting — Prettier

Formatting is enforced via Prettier. The project root contains `.prettierrc` with the following **immutable** settings:

| Setting          | Value      |
|------------------|------------|
| Quotes           | single     |
| Semicolons       | always     |
| Trailing commas  | es5        |
| Print width      | 100        |
| Tab width        | 2          |
| Tabs             | false      |
| BOM              | false      |
| End of line      | lf         |

> Use `npx prettier --check .` in CI to verify; `npx prettier --write .` to auto-fix.

---

## 3. Linting — ESLint

ESLint enforces code quality. The following configurations and rules are **required**:

### 3.1 Base configs

- `@typescript-eslint/recommended`
- `react-hooks/recommended`
- `plugin:import/recommended` + `plugin:import/typescript`

### 3.2 Key rules

| Rule                                                        | Severity | Notes                                    |
|-------------------------------------------------------------|----------|------------------------------------------|
| `@typescript-eslint/no-unused-vars`                         | error    | `argsIgnorePattern: "^_"` permitted      |
| `@typescript-eslint/no-explicit-any`                        | warn     | Prefer `unknown`; suppress with reason   |
| `@typescript-eslint/explicit-function-return-type`          | warn     | Omitted on trivial event handlers        |
| `@typescript-eslint/explicit-module-boundary-types`         | warn     |                                          |
| `@typescript-eslint/no-non-null-assertion`                  | error    | Use early return / guard instead         |
| `no-console`                                                | warn     | Allow `console.warn` / `console.error`   |
| `import/order`                                              | error    | Groups below                             |
| `import/no-duplicates`                                      | error    |                                          |
| `import/no-default-export`                                  | off      | We use one default export per file       |
| `react-hooks/rules-of-hooks`                                | error    |                                          |
| `react-hooks/exhaustive-deps`                               | warn     |                                          |

### 3.3 `import/order` group configuration

```
groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index']
pathGroups:
  - pattern: '@/**'
    group: internal
    position: after
newlines-between: always
alphabetize: { order: 'asc' }
```

---

## 4. Naming Conventions

A quick summary — see [NAMING_CONVENTION.md](./NAMING_CONVENTION.md) for exhaustive rules.

| Category            | Convention                  | Example                     |
|---------------------|-----------------------------|-----------------------------|
| Source files        | camelCase (utils/hooks)     | `useAuth.ts`, `formatDate.ts` |
| Component files     | PascalCase                  | `MemberList.tsx`, `LoginPage.tsx` |
| Variables           | camelCase                   | `userName`, `errorMessage`  |
| Functions           | camelCase, verb prefix      | `fetchMembers()`, `handleSubmit()` |
| Types / Interfaces  | PascalCase                  | `UserProfile`, `ApiResponse` |
| Enums               | PascalCase, UPPER_CASE mems | `enum Role { ADMIN, USER }`  |
| Constants           | UPPER_SNAKE_CASE            | `MAX_LOGIN_ATTEMPTS`         |
| Boolean variables   | is / has / should prefix    | `isLoading`, `hasError`     |
| React state setters | `set` + PascalCase          | `setUser`, `setIsVisible`   |

- Prefer **no `I` prefix** on interfaces (use `I` only to disambiguate from class name).
- Type aliases (`type`) follow the same PascalCase rule.

---

## 5. File Organization

- **One default export per file.** Utility files may additionally export named helpers.
- **Named exports** for utilities, constants, types (no default on pure type/const files).
- **Maximum 300 lines per file.** If exceeded, split into smaller modules.
- **Co-location:** Files that are closely related (e.g., a component and its sub-components) belong in the same directory.
- **Side effects:** Import side-effect files (`.css`, `.scss`) only at application entry points.

---

## 6. Imports

### 6.1 Aliases

- Use `@/` (or `~/`) absolute alias for anything inside `src/`.
  ```ts
  import { MemberService } from '@/services/memberService';
  ```
- **Relative imports** only for files in the same directory or direct parent:
  ```ts
  import { MemberCard } from './MemberCard';
  import { formatDate } from '../utils/formatDate';
  ```

### 6.2 Group order

1. **Built-in** — Node built-ins (`path`, `fs`)
2. **External** — npm packages (`react`, `express`, `mongoose`)
3. **Internal** — Modules aliased from `@/` or `~/`
4. **Parent** — `../` imports
5. **Sibling** — `./` imports
6. **Index** — `./index` (avoid; no barrel files)

> See 3.3 for ESLint auto-enforcement.

### 6.3 Barrel files — FORBIDDEN

Do **not** create `index.ts` files that re-export other modules. Import directly from the source file.

```ts
// BAD — index.ts barrel
export { MemberService } from './memberService';
export { PaymentService } from './paymentService';

// GOOD — direct import
import { MemberService } from '@/services/memberService';
```

---

## 7. Functions

- **Pure functions** are preferred over functions with side effects wherever practical.
- **Maximum 3 parameters.** Use a named options object (typed interface) for 4+.
  ```ts
  // Prefer
  function createMember(name: string, email: string, plan: PlanType): Member { ... }

  // More than 3 params → options object
  interface CreateMemberOptions {
    name: string;
    email: string;
    plan: PlanType;
    referralCode?: string;
  }
  function createMember(opts: CreateMemberOptions): Member { ... }
  ```
- **Async functions** must declare the returned `Promise<Type>` explicitly.
  ```ts
  async function getMember(id: string): Promise<Member> { ... }
  ```
- **No callback hell.** Use `async/await` exclusively; avoid raw `.then()` chains and callback-based APIs.
- **Arrow functions** vs `function` — use `function` for top-level named declarations; arrow for anonymous callbacks and short lambdas.

---

## 8. Error Handling

- **Never swallow errors.** Every `catch` block must handle, wrap, or re-throw the error.
  ```ts
  // BAD
  try { ... } catch { }

  // GOOD
  try { ... } catch (err) {
    throw AppError.fromUnknown(err);
  }
  ```
- **Typed errors only.** Use the project's `AppError` class (never raw `Error` or `string`).
  ```ts
  throw new AppError('MEMBER_NOT_FOUND', 'Member not found', 404);
  ```
- **Never expose stack traces to the client.** In API responses, return only `{ code, message }`.
- **Global error handler** (Express middleware) catches unhandled rejections and transforms them into safe responses.

---

## 9. Comments

- **DO NOT add comments** unless the logic is genuinely non-obvious. Let the code speak.
- **JSDoc** is reserved for **public APIs** exported from modules (services, utilities, hooks).
  ```ts
  /** Fetches a member by ID. Returns null when not found. */
  export async function getMember(id: string): Promise<Member | null>
  ```
- **No commented-out code.** Delete it. Git history will retain it if needed.
- **No TODO / FIXME / HACK** in committed code. Use the project's issue tracker instead.
- **Inline comments** should explain *why*, not *what*. Avoid redundant:
  ```ts
  // BAD — states the obvious
  i++; // increment i

  // GOOD — explains reasoning
  // Offset by one because the API uses 1-based pagination
  i++;
  ```

---

## 10. Security

- **No secrets in source code.** All keys, tokens, passwords go in `.env` files loaded via `process.env`.
  - `.env` is `.gitignore`d. Use `.env.example` for documentation.
- **Input validation on ALL user input.** Use Zod schemas or class-validator on every API route and form submission.
  ```ts
  const schema = z.object({ email: z.string().email() });
  ```
- **Parameterized queries** — Mongoose / Prisma handle this, but be cautious with `$where` or raw `aggregate()` pipelines that build dynamic queries.
- **Escape / sanitize** user content before rendering in responses to prevent XSS.
- **No `eval()`** — banned by ESLint. No `new Function()` either.
- **HTTP headers:** Set `helmet` middleware on Express. Set `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`.

---

## 11. Testing

- **Framework:** Jest (unit), React Testing Library (component).
- **File placement:** Test files sit next to the source file they test.
  ```
  src/services/memberService.ts
  src/services/memberService.test.ts
  ```
- **Coverage threshold:** Minimum **80%** on business logic (services, utilities, hooks).
  - UI-only components (presentational) are exempt but encouraged.
- **Naming:** `describe` blocks describe the unit; `it` / `test` describes the behaviour.
- **No `it.only` / `describe.only`** in committed code.
- **Mocking:** Use `jest.mock` for external modules; prefer dependency injection over deep mocking.

---

## 12. Git

### 12.1 Conventional Commits

```
<type>(<scope>): <description>

[optional body]
```

| Type       | Usage                                      |
|------------|--------------------------------------------|
| `feat`     | New feature                                |
| `fix`      | Bug fix                                    |
| `chore`    | Tooling, dependency, CI changes            |
| `docs`     | Documentation only                         |
| `refactor` | Code change that neither fixes nor adds    |
| `test`     | Adding or updating tests                   |
| `perf`     | Performance improvement                    |
| `style`    | Formatting, lint fixes (no logic change)   |

Examples:
```
feat(members): add bulk-import endpoint
fix(api): handle null membership expiry
chore(deps): upgrade mongoose to v8
```

### 12.2 Branch naming

```
feat/<short-description>
fix/<issue-number-or-description>
chore/<description>
```

- Use kebab-case for descriptions.
- Branch from `main`, merge via pull request only.

### 12.3 Rules

- **No direct pushes to `main`.** All changes go through pull requests.
- **Rebase** feature branches onto `main` before opening a PR (no merge commits).
- **Squash-merge** to `main` to keep history linear.
- PR title must match the conventional commit that will be created on merge.
