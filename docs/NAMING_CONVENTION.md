# GymPro Naming Conventions

> **Scope:** All code, configuration, and assets within the GymPro Gym Management System.
> **Enforcement:** These conventions MUST be followed in all pull requests. Violations should be caught during code review and via lint rules.

---

## Table of Contents

1. [Files & Directories](#1-files--directories)
2. [Variables](#2-variables)
3. [Functions](#3-functions)
4. [Types & Interfaces](#4-types--interfaces)
5. [React Specific](#5-react-specific)
6. [CSS & Styling](#6-css--styling)
7. [Database (MongoDB)](#7-database-mongodb)
8. [API](#8-api)
9. [Environment Variables](#9-environment-variables)
10. [Git](#10-git)

---

## 1. Files & Directories

| Category | Convention | Example | Rationale |
|---|---|---|---|
| React components / pages | PascalCase.tsx | `MembershipCard.tsx`, `DashboardPage.tsx` | JSX components are classes/factories; PascalCase matches the exported component name for IDE navigation. |
| Hooks | camelCase with `use` prefix | `useAuth.ts`, `useMembershipCycle.ts` | React hook convention enforced by ESLint `react-hooks/rules-of-hooks`. |
| Services | camelCase | `authService.ts`, `paymentService.ts`, `bookingService.ts` | Services are singleton modules; camelCase conveys regular module semantics. |
| Utils | camelCase | `dateUtils.ts`, `numberUtils.ts`, `validationUtils.ts` | Pure utility modules; same rationale as services. |
| Config | camelCase | `database.ts`, `appConfig.ts`, `corsConfig.ts` | Plain configuration objects; camelCase is idiomatic for modules exporting a single object. |
| Types / Interfaces | PascalCase | `userTypes.ts`, `membershipTypes.ts`, `apiTypes.ts` | File exports PascalCase types; filename mirrors the primary exported type. |
| Styles (CSS Modules) | kebab-case | `membership-card.module.css`, `dashboard-layout.module.css` | CSS built-in `kebab-case` avoids camelCase ambiguity with JS identifiers; `.module.css` enables CSS Modules scoping. |
| Style (Global) | kebab-case | `globals.css`, `reset.css` | Standard CSS naming convention; no module suffix for global stylesheets. |
| Directories | camelCase | `src/services/`, `src/components/auth/`, `src/hooks/` | Matches Node.js/import convention; avoids mixed case sensitivity issues across platforms. |
| Routes (path segments) | kebab-case | `/membership-plans`, `/booking-slots`, `/payment-history` | URLs are case-insensitive; kebab-case is the HTTP/URI standard. |
| Models (Mongoose schemas) | PascalCase.ts | `MembershipCycle.ts`, `BookingSlot.ts`, `User.ts` | Mongoose models are constructors; PascalCase matches the exported class/model name. |
| Test files | `{sourceName}.test.ts(x)` | `authService.test.ts`, `MembershipCard.test.tsx` | Jest/Vitest convention; co-located with source for discoverability. |
| Story files | `{componentName}.stories.tsx` | `MembershipCard.stories.tsx` | Storybook convention; mirrors test file pattern. |

### Exception

**Models:** Mongoose schema files are PascalCase (e.g., `MembershipCycle.ts`), but the collection name stored in MongoDB is `plural snake_case` (e.g., `membership_cycles`). The model class name in code is singular PascalCase.

---

## 2. Variables

| Category | Convention | Example | Rationale |
|---|---|---|---|
| Local variables | camelCase | `const userName = 'John';` | Standard JavaScript/TypeScript convention. |
| Constants (module-scoped, primitive) | UPPER_SNAKE_CASE | `const MAX_RETRY_COUNT = 3;` <br> `const DEFAULT_PAGE_SIZE = 20;` | Visually distinguishes immutable primitives from mutable values. |
| Constants (object/reference) | camelCase | `const appConfig = { ... };` <br> `const emptyState = { ... };` | Object references are technically constant but their contents mutate; camelCase avoids false implication of deep immutability. |
| Destructured props | camelCase, matching source | `const { fullName, email } = user;` | Matches the original key; predictable regardless of source casing. |
| Loop counters | `i`, `j`, `k` (simple) <br> `index`, `item` (descriptive) | `for (let i = 0; i < items.length; i++)` <br> `items.forEach((item, index) => ...)` | Single-letter for tight loops; descriptive when loop body is complex. |
| Boolean prefixes | `is`, `has`, `should`, `can`, `will` | `isActive`, `hasPermission`, `shouldRender`, `canSubmit`, `willExpire` | Hungarian-style prefix makes boolean intent explicit at the call site. |
| Accumulators / temp | camelCase, short | `acc`, `result`, `tmp`, `prev`, `curr` | Standard reduce/temp naming; clear from context. |

### Avoid

- **Trailing/leading underscores** on public variables (reserved for class-private fields only).
- **Single-letter names** except in loop counters, generics, or math-heavy contexts (`x`, `y`, `r`).

---

## 3. Functions

| Category | Convention | Example | Rationale |
|---|---|---|---|
| Regular functions | camelCase | `function getUserById(id: string)` <br> `const formatDate = (date: Date) => ...` | Idiomatic JavaScript; consistent with variables. |
| Event handlers | `handle` prefix | `handleSubmit`, `handleClick`, `handleInputChange` | Immediately identifiable as event callbacks; distinguishable from business logic. |
| Async functions | async keyword; `Promise<T>` return | `async function fetchMemberships(): Promise<Membership[]>` | Standard `async/await` convention; return type annotated explicitly. |
| API service functions | HTTP verb prefix | `getMemberships`, `createBooking`, `updateProfile`, `deleteSlot`, `patchSettings` | Maps 1:1 to REST verbs; call site reads like a CRUD operation. |
| React effects | descriptive name | `useMembershipSync`, `useAuthRedirect`, `usePaymentPolling` | Describes *what* the effect does; treated like a custom hook. |
| Private functions (classes) | `_` prefix | `class PaymentService { _processPayment() { ... } }` | Conventional visibility marker in JS classes (TypeScript `private` keyword should also be used). |
| Predicate / boolean-returning | `is`, `has`, `can` prefix | `isExpired(date)`, `hasOverlappingBooking(slot)` | Same convention as boolean variables; reads naturally in conditionals. |
| Transform / mapping | `to` or `from` prefix | `toDTO(user)`, `fromDTO(payload)`, `toISOString()` | Indicates conversion between representations. |
| Factory functions | `create` prefix | `createMembershipCycle(data)`, `createInitialState()` | Standard factory naming; `new` keyword reserved for classes. |

### Prefer modules over classes

Instead of a `class` with static/private methods, prefer a module exporting public functions with internal helpers as module-private (not exported). This avoids `_` prefix usage entirely in most cases.

---

## 4. Types & Interfaces

| Category | Convention | Example | Rationale |
|---|---|---|---|
| Interfaces | PascalCase | `interface User { ... }` <br> `interface MembershipCycle { ... }` | TypeScript standard; interfaces represent contracts. |
| Type aliases | PascalCase | `type BookingStatus = 'pending' \| 'confirmed';` <br> `type PaginatedResponse<T> = { ... }` | Matches interface casing for consistency; distinguishable in tooltips from variables. |
| Enums | PascalCase enum name; UPPER_SNAKE_CASE members | `enum BookingStatus { PENDING = 'pending', CONFIRMED = 'confirmed' }` | Enum values are constants; string values should be kebab-case (`'pending'`) matching API convention. |
| Generics (simple) | Single uppercase letter | `<T>`, `<K>`, `<V>` | Standard TypeScript generics. |
| Generics (descriptive) | PascalCase with `T` prefix | `<TData>`, `<TResponse>`, `<TPayload>` | Avoids ambiguity in complex generics; `T` prefix signals it's a type parameter. |
| Props type | `Props` (or `{ComponentName}Props` if ambiguous) | `type Props = { ... }` <br> `type MembershipCardProps = { ... }` | Short and file-local; full name only needed for exported/ambiguous types. |
| State type | `State` (or `{ComponentName}State` if ambiguous) | `type State = { ... }` <br> `type DashboardState = { ... }` | Same rationale as Props. |
| Return types | `T{Verb}Response` or `{Entity}DTO` | `type LoginResponse = { token: string }` <br> `type UserDTO = { ... }` | Self-documenting; distinguishable from domain models. |
| Function type signatures | `T{Verb}Handler` or `{Context}Fn` | `type SubmitHandler = (data: FormData) => void` <br> `type AuthFn = (creds: Credentials) => Promise<User>` | Describes role rather than exact shape. |

### Order of preference

1. `interface` — prefer for object shapes that may be extended or implemented.
2. `type` — prefer for unions, intersections, mapped types, and utility types.

---

## 5. React Specific

| Category | Convention | Example | Rationale |
|---|---|---|---|
| Components | PascalCase, matches filename | `function MembershipCard() { ... }` <br> `export default MembershipCard;` | Required by JSX; filename must be identical to default export. |
| Custom hooks | camelCase, must start with `use` | `function useAuth() { ... }` <br> `function useMembershipCycle(id: string) { ... }` | Enforced by ESLint `react-hooks/rules-of-hooks`. |
| Context providers | PascalCase with `Provider` suffix | `const AuthProvider = ({ children }) => { ... }` | Identifiable as a provider component; co-located with context. |
| Context value type | PascalCase with `Context` suffix | `interface AuthContext { user: User \| null; login: (c: Credentials) => void }` | Distinguishable from entity/API types. |
| Props interface | `Props` (file-local) or `{Name}Props` (exported) | `type Props = { name: string }` | Short when local; explicit when shared. |
| State variables | `[value, setValue]` camelCase | `const [user, setUser] = useState(null);` | Standard React convention; pair is always verb+setVerb. |
| Ref variables | `{noun}Ref` suffix | `const inputRef = useRef(null);` <br> `const containerRef = useRef(null);` | Immediately identifiable as a ref object; avoids confusion with state. |
| Callback props | `on` prefix | `onSubmit`, `onClose`, `onChange`, `onSelect` | Standard React/HTML convention. |
| Event handlers | `handle` prefix | `const handleSubmit = (e) => { ... }` <br> `const handleInputChange = (e) => { ... }` | Distinguishes handler from callback prop (e.g., `onSubmit={handleSubmit}`). |
| Memoized values | `useMemo` / `useCallback` with descriptive name | `const sortedMemberships = useMemo(...)` | Variable name describes *what* the computed value is. |
| Effect cleanup | `return () => { /* cleanup */ }` inside `useEffect` | `useEffect(() => { sub.subscribe(); return () => sub.unsubscribe(); }, [])` | Standard effect cleanup pattern. |

### Export pattern

```typescript
// Always use named export for components
export function MembershipCard({ name }: Props) { ... }

// Default export for dynamic imports / lazy loading
export default MembershipCard;
```

---

## 6. CSS & Styling

| Category | Convention | Example | Rationale |
|---|---|---|---|
| CSS Modules class names | camelCase | `.membershipCard { }` <br> `.dashboardLayout { }` | Accessed as JS object property (`styles.membershipCard`); camelCase avoids bracket notation. |
| Tailwind CSS | utility classes directly | `className="flex items-center gap-4 p-6"` | Framework convention; no custom CSS for trivial layouts. |
| CSS custom properties | kebab-case | `--primary-color: #1a73e8;` <br> `--spacing-md: 16px;` | CSS native convention; case-insensitive but kebab is standard. |
| Animation `@keyframes` | kebab-case | `@keyframes fade-in { ... }` <br> `@keyframes slide-up { ... }` | Matches CSS property naming style. |
| BEM blocks (non-module) | kebab-case | `.membership-card__header--active` | Industry standard for non-modular CSS. |

### Order

1. **Tailwind** — for spacing, typography, layout, color (90%+ of cases).
2. **CSS Modules** — for component-specific styles that can't be expressed in Tailwind.
3. **Global CSS** — only for reset, CSS custom properties, and keyframe animations.

---

## 7. Database (MongoDB)

| Category | Convention | Example | Rationale |
|---|---|---|---|
| Collection names | Plural snake_case | `membership_cycles`, `booking_slots`, `users`, `payments` | MongoDB convention; plural avoids singular/plural confusion across models. |
| Field names (MongoDB) | snake_case | `full_name`, `membership_plan_id`, `created_at` | Standard database convention; language-agnostic. |
| Field names (Mongoose schema) | camelCase (mapped via `field`) | `fullName: { type: String, field: 'full_name' }` | JavaScript convention in code; transparent mapping to DB. |
| Index names | `idx_{fields}_{direction}` | `idx_email_1` <br> `idx_status_createdAt_-1` | Self-documenting; includes direction (`1` asc, `-1` desc) for query plan analysis. |
| Compound index names | `idx_{field1}_{d1}_{field2}_{d2}` | `idx_status_1_createdAt_-1` | Lists fields in index order with their directions. |
| Text index names | `idx_{field}_text` | `idx_name_text`, `idx_description_text` | Explicitly marks text indexes. |
| Unique index names | `uq_{fields}` | `uq_email`, `uq_slug` | Distinguishes unique constraints from non-unique indexes. |
| Foreign key references | `{referenced_collection}_id` | `membership_plan_id`, `user_id`, `booking_slot_id` | Readable at query time without joins; consistently identifies relationships. |
| Timestamp fields | `created_at`, `updated_at` | Always present via Mongoose `timestamps: true` | Standard; mapped to `createdAt`/`updatedAt` in code. |

### Mongoose schema example

```typescript
const membershipCycleSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', field: 'user_id', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'MembershipPlan', field: 'membership_plan_id', required: true },
    startDate: { type: Date, field: 'start_date', required: true },
    endDate: { type: Date, field: 'end_date', required: true },
    status: { type: String, enum: ['active', 'frozen', 'expired'], field: 'status', default: 'active' },
  },
  { timestamps: true }
);
```

---

## 8. API

| Category | Convention | Example | Rationale |
|---|---|---|---|
| URL endpoints | Plural kebab-case | `GET /api/v1/membership-plans` <br> `POST /api/v1/booking-slots` <br> `DELETE /api/v1/users/:id` | Plural resources per REST best practice; kebab-case for URL friendliness. |
| URL parameter names | camelCase | `/api/v1/membership-plans/:planId` | Matches JavaScript variable naming in route handlers. |
| Query parameters | camelCase | `?sortBy=createdAt&pageSize=20&isActive=true` | Consistent with JS naming; passed directly to service functions. |
| Request body keys | snake_case | `{ "membership_plan_id": "...", "start_date": "..." }` | Mirrors MongoDB field names; consistent across frontend and backend. |
| Response body keys | snake_case | `{ "user_id": "...", "full_name": "...", "membership_cycles": [...] }` | Same rationale as request body; consumers don't need to transform casing. |
| HTTP headers | Standard headers; custom headers with `X-` prefix | `Authorization: Bearer <token>` <br> `X-Request-Id: <uuid>` | HTTP/1.1 standard; custom headers use `X-` prefix convention. |
| Error response shape | `{ error: string, message: string, statusCode: number }` | See `apiTypes.ts` | Consistent error contract for all endpoints. |
| Paginated response shape | `{ data: T[], pagination: { page, pageSize, total } }` | See `apiTypes.ts` | Standard pagination envelope for list endpoints. |
| API version prefix | `/api/v{major}` | `/api/v1/membership-plans` | Enables breaking changes without disrupting existing clients. |

---

## 9. Environment Variables

| Category | Convention | Example | Rationale |
|---|---|---|---|
| All env vars | UPPER_SNAKE_CASE with `GYMPRO_` prefix | `GYMPRO_DB_URI=mongodb://...` <br> `GYMPRO_JWT_SECRET=...` <br> `GYMPRO_PORT=4000` | Namespace prevents collisions; immediately identifiable as GymPro config. |
| Boolean env vars | `GYMPRO_{FEATURE}_ENABLED` | `GYMPRO_PAYMENT_GATEWAY_ENABLED=true` | Explicit boolean check; no ambiguity about truthy/falsy coercion. |
| Node environment | `NODE_ENV` (no prefix) | `NODE_ENV=development` | Standard Node.js convention; used by tools, not app config. |
| .env file | No quotes around values | `GYMPRO_DB_URI=mongodb://localhost:27017/gympro` | Parsed literally; quotes become part of the string value. |

### Access pattern

```typescript
// Always validate at startup via a config module
const config = {
  dbUri: process.env.GYMPRO_DB_URI,
  jwtSecret: process.env.GYMPRO_JWT_SECRET,
  port: parseInt(process.env.GYMPRO_PORT ?? '4000', 10),
};

// Never access process.env directly in business logic
```

---

## 10. Git

| Category | Convention | Example | Rationale |
|---|---|---|---|
| Branch names | `{type}/{description}` | `feat/membership-freeze` <br> `fix/payment-race-condition` <br> `chore/update-deps` <br> `refactor/auth-service` | Groups branches by purpose; `/` enables folder-like grouping in Git GUI tools. |
| Branch types | `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`, `perf`, `ci`, `build`, `revert` | Conventional commit types. | Aligns with commit message standard for consistent automation. |
| Commit messages | `{type}({scope}): {description}` | `feat(membership): add freeze functionality` <br> `fix(payment): handle race condition on concurrent charges` <br> `refactor(auth): extract token validation` | Conventional Commits spec; enables automatic changelog generation and semantic versioning. |
| Commit description | imperative present tense, lowercase, no trailing period | `feat(membership): add freeze functionality` (not `added` or `adds`) | Git convention; "this commit will ..." should complete the sentence. |
| Commit body | wrapped at 72 chars; explains *why* not *what* | `The freeze endpoint was missing idempotency...` <br> `Fixes #142` | The diff shows *what*; the body explains *why*. |
| PR titles | Same format as commit messages | `feat(membership): add freeze functionality` | Squash-merge uses PR title as commit message. |
| Issues / ticket references | `#{number}` in body or footer | `Closes #142` <br> `Refs PROJ-456` | Auto-links in GitHub; enables cross-reference. |

### Branch naming examples

| Type | Branch Name |
|---|---|
| New feature | `feat/membership-freeze` |
| Bug fix | `fix/payment-race-condition` |
| Refactoring | `refactor/auth-service` |
| Chore / maintenance | `chore/update-express-v4` |
| Documentation | `docs/api-endpoints` |
| Performance | `perf/optimize-membership-query` |
| Style / formatting | `style/eslint-config` |

### Commit message template

```
<type>(<scope>): <description>

[optional body — explain why, not what]

[optional footer — breaking changes, issue references]
```

---

## Enforcement

- **ESLint** — `camelCase` rule for variables/functions; `PascalCase` for components (react/jsx-pascal-case).
- **Prettier** — consistent formatting (enforced via `.prettierrc`).
- **Husky / lint-staged** — pre-commit hooks run linting on staged files.
- **Code Review** — PRs must conform to this convention document. Reviewers should block PRs with violations.
- **CI Pipeline** — `npm run lint` fails the build on naming violations.

---

*Last updated: 2026-07-20*
