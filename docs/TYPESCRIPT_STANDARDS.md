# TypeScript Standards

> **Version:** 5.9  
> **Strict mode:** Enabled in both `frontend/tsconfig.json` and `backend/tsconfig.json`

---

## 1. tsconfig.json Settings

Both frontend and backend share the following strict compilation settings:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": false,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "forceConsistentCasingInFileNames": true,
  "resolveJsonModule": true,
  "esModuleInterop": true
}
```

| Setting | Purpose |
|---|---|
| `strict: true` | Enables all strict type-checking flags |
| `noUncheckedIndexedAccess` | Adds `undefined` to every indexed access (`obj[key]` is `T \| undefined`) |
| `exactOptionalPropertyTypes: false` | Optional properties accept `undefined` in addition to their declared type |
| `noUnusedLocals` / `noUnusedParameters` | Catches dead code at compile time |
| `forceConsistentCasingInFileNames` | Ensures cross-platform filename case consistency |
| `resolveJsonModule` / `esModuleInterop` | Enables JSON imports and default-import interop |

---

## 2. Type Definitions

- **Location:** All shared types live in `src/types/` and are consumed by both frontend and backend.
- **No `any`:** Never use the `any` type. Prefer `unknown` and narrow via type guards, assertions, or runtime validation.
- **Mongoose:** Define an interface for the document shape and a separate input type for creation/update payloads.
- **API responses:** Use generic wrappers (`ApiResponse<T>`, `PaginatedResponse<T>`) so every endpoint returns a consistent envelope.
- **Form types:** Keep form state types separate from API types. A form may hold intermediate values, partial data, or different validation constraints than the wire format.

```typescript
// Mongoose document interface
export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name?: string;
}

// Input type for creating a user
export interface CreateUserInput {
  email: string;
  name?: string;
}
```

```typescript
// API response wrappers
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

```typescript
// Separate form type (may differ from API shape)
export interface UserFormValues {
  email: string;
  name: string;
  confirmEmail: string; // present on the form, absent from the API
}
```

---

## 3. Naming Conventions

| Category | Convention | Examples |
|---|---|---|
| Interfaces | PascalCase | `User`, `MembershipCycle`, `IBooking` |
| Type aliases | PascalCase | `BookingStatus`, `PlanDuration`, `ApiResult<T>` |
| Enums | PascalCase enum, UPPER_CASE members | `enum BookingStatus { PENDING, CONFIRMED, CANCELLED }` |
| Generics | Single uppercase (`T`, `K`, `V`) or descriptive (`TData`, `TResponse`) | `function map<T, U>(...)` |
| Utility types | CamelCase | `Nullable<T>`, `DeepPartial<T>`, `Writable<T>` |

```typescript
// Enum
export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

// Utility type
export type Nullable<T> = T | null;

export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;
```

---

## 4. Patterns

### Interfaces for public API contracts

Use `interface` for shapes that represent stable contracts — especially objects that may be extended or implemented.

```typescript
export interface IMembershipCycle {
  startDate: Date;
  endDate: Date;
  planId: string;
}
```

### Types for unions, intersections, and computed types

Use `type` for anything that is a union, intersection, mapped, or conditional.

```typescript
export type PlanDuration = 'monthly' | 'quarterly' | 'yearly';

export type BookingWithUser = IBooking & { user: IUser };

export type Mutable<T> = { -readonly [P in keyof T]: T[P] };
```

### `type` over `interface` for React Props

Using `type` for props ensures consistency and avoids subtle `interface` merging issues.

```typescript
export type ButtonProps = {
  label: string;
  variant: 'primary' | 'secondary';
  onClick: () => void;
};

export const Button: React.FC<ButtonProps> = ({ label, variant, onClick }) => { ... };
```

### `typeof` and `keyof` for derived types

```typescript
const config = { apiUrl: 'https://...', timeout: 5000 } as const;
type Config = typeof config;        // { readonly apiUrl: "https://..."; readonly timeout: 5 }
type ConfigKey = keyof Config;      // "apiUrl" | "timeout"
```

### `as const` for literal types

Use `as const` to preserve the exact literal values of objects, arrays, or primitives.

```typescript
export const BOOKING_STATUS_VALUES = ['PENDING', 'CONFIRMED', 'CANCELLED'] as const;
export type BookingStatus = (typeof BOOKING_STATUS_VALUES)[number];

export const DEFAULT_PAGINATION = { page: 1, limit: 20 } as const;
```

### `satisfies` for type validation without widening

Use `satisfies` to validate that an expression matches a type while retaining its narrowest inferred type.

```typescript
type Color = 'red' | 'green' | 'blue';
type Theme = { primary: Color; secondary: Color };

const theme = {
  primary: 'blue',
  secondary: 'green',
} satisfies Theme;

// theme.primary is literal 'blue', not widened to Color
```

---

## 5. Generic Conventions

### Function generics

```typescript
function query<T>(input: T): T {
  return input;
}

async function fetchData<T>(url: string): Promise<ApiResponse<T>> {
  const res = await fetch(url);
  return res.json();
}
```

### React generics

```typescript
const [data, setData] = useState<BookingStatus | null>(null);
const [items, setItems] = useState<IUser[]>([]);

const { data: members } = useQuery<ApiResponse<IMember[]>>('members', fetchMembers);
```

### Mongoose generics

```typescript
import { Model, Document, model, Schema, Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  name?: string;
}

export type UserDoc = IUser & Document;

export const UserModel = model<IUser, Model<IUser>>('User', userSchema);
```

---

## 6. Mongoose Type Safety

Always follow the **interface → document type → typed model** pattern.

```typescript
import { Schema, Model, Document, model, Types } from 'mongoose';

// 1. Interface describing the raw document shape (no Mongoose extras)
export interface IBooking {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// 2. Document type (interface + Mongoose Document methods)
export type BookingDoc = IBooking & Document;

// 3. Typed model
export const BookingModel = model<IBooking, Model<IBooking>>('Booking', bookingSchema);
```

Input types for creation/update should exclude auto-generated fields:

```typescript
export type CreateBookingInput = Omit<IBooking, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateBookingInput = Partial<CreateBookingInput>;
```

---

## 7. React Type Safety

### Props

```typescript
export type CardProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export const Card: React.FC<CardProps> = ({ title, children, className }) => { ... };
```

### useState — always provide the type

```typescript
const [user, setUser] = useState<IUser | null>(null);
const [count, setCount] = useState<number>(0);
```

### useRef

```typescript
const inputRef = useRef<HTMLInputElement>(null);
const divRef = useRef<HTMLDivElement>(null);
```

### Event handlers — use React synthetic types

```typescript
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
};

const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.stopPropagation();
};
```

### Context

```typescript
import { createContext, useContext } from 'react';

export interface AuthContextValue {
  user: IUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
```

---

## 8. API Response Types

Every endpoint returns one of two shapes through a `ApiResult<T>` discriminated union.

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    field?: string;
  };
}

type ApiResult<T> = ApiResponse<T> | ApiError;
```

Usage in a service layer:

```typescript
async function getMember(id: string): Promise<ApiResult<IMember>> {
  try {
    const member = await MemberModel.findById(id);
    if (!member) {
      return { success: false, error: { code: 'NOT_FOUND', message: 'Member not found' } };
    }
    return { success: true, data: member.toObject() };
  } catch (err) {
    return { success: false, error: { code: 'INTERNAL', message: 'Failed to fetch member' } };
  }
}
```

Usage in a React hook:

```typescript
const { data } = useQuery({
  queryKey: ['member', id],
  queryFn: () => getMember(id),
  select: (result: ApiResult<IMember>) => {
    if (result.success) return result.data;
    throw new Error(result.error.message);
  },
});
```

---

## 9. Import Type

Always use `import type` for type-only imports to avoid generating runtime imports in the compiled output.

```typescript
// Type-only import (preferred when importing only types)
import type { IUser, CreateUserInput } from '@/types/user';

// Mixed import (when both a value and a type are needed from the same module)
import { useState, type ReactNode } from 'react';
import { model, type Model } from 'mongoose';
```

---

## 10. Discriminated Unions

Use discriminated unions to model mutually exclusive states. The discriminant is always a literal string or number.

### State machines

```typescript
type BookingState =
  | { status: 'pending' }
  | { status: 'confirmed'; confirmedAt: Date; confirmedBy: string }
  | { status: 'cancelled'; cancelledAt: Date; reason: string }
  | { status: 'checked_in'; checkedInAt: Date };

function handleBookingState(state: BookingState): string {
  switch (state.status) {
    case 'pending':
      return 'Awaiting confirmation';
    case 'confirmed':
      return `Confirmed on ${state.confirmedAt.toISOString()}`;
    case 'cancelled':
      return `Cancelled: ${state.reason}`;
    case 'checked_in':
      return 'Checked in';
  }
}
```

### API results

```typescript
type SuccessResponse<T> = { success: true; data: T; message?: string };
type ErrorResponse = { success: false; error: { code: string; message: string } };

type ApiResult<T> = SuccessResponse<T> | ErrorResponse;

function handleResponse<T>(res: ApiResult<T>): T {
  if (res.success) return res.data;
  throw new Error(res.error.message);
}
```

### Form state

```typescript
type FormState<T> =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'submitting' }
  | { status: 'success'; data: T }
  | { status: 'error'; fieldErrors: Record<string, string> };
```

---

## 11. Utility Types to Know

| Utility | Description | Example |
|---|---|---|
| `Pick<T, K>` | Creates a type with only keys `K` from `T` | `Pick<IUser, 'email' \| 'name'>` |
| `Omit<T, K>` | Creates a type without keys `K` from `T` | `Omit<IUser, '_id' \| 'createdAt'>` |
| `Partial<T>` | Makes all properties optional | `Partial<IUser>` |
| `Required<T>` | Makes all properties required | `Required<IUser>` |
| `Readonly<T>` | Makes all properties readonly | `Readonly<Config>` |
| `Record<K, V>` | Object type with keys `K` and values `V` | `Record<string, IUser>` |
| `Exclude<T, U>` | Excludes union members assignable to `U` | `Exclude<BookingStatus \| null, null>` |
| `Extract<T, U>` | Extracts union members assignable to `U` | `Extract<Status, 'active' \| 'pending'>` |
| `NonNullable<T>` | Removes `null` and `undefined` from `T` | `NonNullable<IUser \| null>` |
| `ReturnType<F>` | Infers the return type of a function | `ReturnType<typeof fetchUser>` |
| `Parameters<F>` | Infers the parameter tuple of a function | `Parameters<typeof fetchUser>` |
| `Awaited<T>` | Unwraps promises recursively | `Awaited<Promise<Promise<string>>>` → `string` |

```typescript
// Common patterns
export type CreateUserPayload = Omit<IUser, '_id' | 'createdAt' | 'updatedAt'>;
export type UserLookup = Record<string, IUser>;
export type SafeUser = Omit<IUser, 'passwordHash'>;
export type AsyncReturnType<T extends (...args: unknown[]) => unknown> = Awaited<ReturnType<T>>;
```
