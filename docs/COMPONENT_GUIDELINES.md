# React Component Guidelines

## 1. Component Architecture

- **Presentational vs Container (hooks-based)**: Components are split into presentational (pure UI) and containers that use custom hooks. Containers are regular function components that call hooks to fetch data and provide it to presentational children.
- **Data via props**: Components receive data through props only — no direct API calls inside presentational components.
- **Custom hooks**: Encapsulate all data fetching, caching, and state logic within reusable custom hooks (e.g., `useMemberships`, `useBookings`).
- **Pure components**: Presentational components are pure — no side effects, no direct state mutations. Same props always produce the same output.

```tsx
// ✅ Good: Hook encapsulates data logic
function MembershipListContainer() {
  const { data, isLoading, error } = useMemberships();
  return <MembershipList data={data} loading={isLoading} error={error} />;
}

// ❌ Avoid: Data fetching inside presentational component
function MembershipList() {
  const [data, setData] = useState();
  useEffect(() => { fetch('/api/memberships').then(setData); }, []);
  // ...
}
```

---

## 2. Component Structure (Ordered)

Every component follows this exact ordering:

```typescript
// 1. Imports
import { useState, useMemo, useCallback } from 'react';
import { Card, Button } from 'antd';

// 2. Types (Props, State)
type MembershipCardProps = {
  memberId: string;
  name: string;
  plan: string;
  expiresAt?: string;
};

// 3. Constants (outside component)
const PLAN_LABELS: Record<string, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// 4. Helper functions (outside component)
function formatExpiry(date: string): string {
  return new Date(date).toLocaleDateString();
}

// 5. Component function
function MembershipCard({ memberId, name, plan, expiresAt }: MembershipCardProps) {
  // 5a. Hooks (state, effects, context)
  const [expanded, setExpanded] = useState(false);

  // 5b. Event handlers
  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // 5c. Derived values (useMemo)
  const expiryLabel = useMemo(() => {
    return expiresAt ? formatExpiry(expiresAt) : 'No expiry';
  }, [expiresAt]);

  // 5d. Render (JSX)
  return (
    <Card>
      <h3>{name}</h3>
      <p>Plan: {PLAN_LABELS[plan] ?? plan}</p>
      <p>Expires: {expiryLabel}</p>
      <Button onClick={handleToggle}>Toggle</Button>
    </Card>
  );
}

// 6. Export (default)
export default MembershipCard;
```

---

## 3. Props Guidelines

- **Use `type`** for Props, not `interface` (consistent with union/intersection usage throughout the app).
- **Order**: Required props first, optional (`?`) props last.
- **Default values** via destructuring:

```tsx
type ButtonProps = {
  label: string;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
};

function AppButton({ label, variant = 'primary', disabled = false }: ButtonProps) {
  // ...
}
```

- **Avoid spreading props** unless forwarding to an underlying DOM element or Antd component (e.g., `<Input {...field} />`).
- **JSDoc** for complex props to explain shape, constraints, or behavior:

```tsx
type MembershipFormProps = {
  /**
   * Existing membership data for editing. Omit for create mode.
   * When provided, the form initializes with these values.
   */
  initialData?: MembershipData;
  /** Called after successful submit with the saved membership. */
  onSuccess: (membership: MembershipData) => void;
};
```

- **Max 10 props** per component. If exceeded, split into smaller components or group related props into a sub-object.

---

## 4. State Management

| Type | Tool | When |
|---|---|---|
| Local UI | `useState` | Toggles, inputs, dropdowns, modals |
| Derived | `useMemo` | Expensive computations, filtered/sorted lists |
| Stable callbacks | `useCallback` | Handlers passed to child components |
| Global app | `useContext` | Auth, theme, settings, notification |
| Server state | TanStack Query | API data fetching, caching, mutations, refetching |

```tsx
// ✅ Good: TanStack Query for server data
function useMemberships() {
  return useQuery({
    queryKey: ['memberships'],
    queryFn: () => api.get('/memberships'),
  });
}

function MembershipList() {
  const { data, isLoading } = useMemberships();
  return isLoading ? <Skeleton /> : <List dataSource={data} />;
}
```

- **No Redux**. Keep state management simple with Context + TanStack Query.

---

## 5. Styling Strategy

| Method | Usage |
|---|---|
| **Antd** | Layout (`Row`, `Col`), forms (`Form`, `Form.Item`), tables (`Table`), modals (`Modal`), notifications (`message`, `notification`) |
| **Tailwind** | Custom styling, spacing (`p-4`, `mt-2`), typography (`text-lg`, `font-semibold`), flex/grid layout |
| **CSS Modules** | Complex component-specific styles that cannot be expressed with Tailwind alone |
| **Inline styles** | Only for truly dynamic values (e.g., `style={{ height: dynamicHeight }}`) |

- Consistent spacing: always use Tailwind spacing scale (`p-1` through `p-16`, `gap-2`, `space-x-4`).

```tsx
// ✅ Good
<div className="flex items-center gap-4 p-6">
  <Avatar src={url} />
  <span className="text-lg font-semibold">{name}</span>
</div>

// ❌ Avoid: Inline styles for static values
<div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
```

---

## 6. Performance

- **`React.memo`**: Wrap expensive pure components that receive the same props frequently.
- **`useMemo`**: Cache derived data (filtered lists, computed values).
- **`useCallback`**: Stable references for event handlers passed to children.
- **Virtual lists**: Use `react-window` for lists exceeding 100 items.
- **Lazy loading**: `React.lazy` + `Suspense` for route-level pages.
- **Image lazy loading**: `<img loading="lazy" />`.
- **Debounce**: Search inputs with 300ms debounce.
- **Avoid inline arrow functions in render** — extract with `useCallback`.

```tsx
// ✅ Good
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
return <Child onClick={handleClick} />;

// ❌ Avoid: New function on every render
return <Child onClick={() => doSomething(id)} />;
```

---

## 7. Accessibility

- **Semantic HTML**: Use `<button>`, `<nav>`, `<main>`, `<section>`, `<article>` instead of generic `<div>`.
- **`aria-label`**: Required on icon-only buttons (e.g., `<Button aria-label="Delete member" icon={<DeleteOutlined />} />`).
- **`role` attributes**: Where semantic elements cannot be used (e.g., `role="alert"`, `role="dialog"`).
- **Keyboard navigation**:
  - `tabIndex` for focusable custom elements.
  - `onKeyDown` for Enter/Escape handlers.
- **Form labels**: Every `<Input>` inside `Form.Item` must have a label.
- **Color contrast**: Follow Antd default tokens — do not override with low-contrast colors.
- **Focus management**: When opening modals/dialogs, trap focus inside and return to trigger on close.

---

## 8. Error Boundaries

- **Root boundary**: One `ErrorBoundary` at the app root to catch unhandled errors.
- **Feature boundaries**: An `ErrorBoundary` per major feature section (e.g., Membership, Booking, Dashboard) to isolate crashes.
- **Fallback UI**:

```tsx
function MembershipErrorFallback() {
  return (
    <div className="flex flex-col items-center p-8">
      <Result
        status="error"
        title="Something went wrong"
        subTitle="Please refresh the page or try again later."
      />
    </div>
  );
}
```

- **Logging**: Error boundaries log error details (component stack, error message) to the monitoring service.

---

## 9. Loading States

- **Initial loads**: Use Antd `<Skeleton>` for cards, lists, and detail pages.
- **Mutations / submissions**: Show `<Spin>` inside the submit button or overlay the form area.
- **Progressive loading**: For large lists, load in chunks (infinite scroll or "Load more") with skeleton at the bottom.
- **No flash-of-loading**: Show skeleton immediately (on mount, before any async operation) so the user perceives instant feedback.

```tsx
function MembershipList({ data, isLoading }: Props) {
  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;
  return <List dataSource={data} renderItem={...} />;
}
```

---

## 10. Empty States

- Display a centered message with an icon when no data exists.
- Include an action button when appropriate to guide the user.

```tsx
function EmptyMemberships() {
  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description="No memberships found"
    >
      <Button type="primary">Book your first session</Button>
    </Empty>
  );
}
```

- Use custom illustrations for key empty states (membership, bookings, payments) to improve UX.

---

## 11. Forms

- **Antd `Form`** with `Form.Item` for layout and validation.
- **Client-side validation**: Use `yup` or `zod` schema validation with Antd's `rules` or a custom validator.
- **Server-side validation**: Map server error responses to per-field `Form.Item` errors using `setFields`.
- **Submission state**: Disable submit button while submitting to prevent double submissions.
- **Destructive actions**: Show a confirmation `Modal` before delete or irreversible changes.

```tsx
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
});

function MembershipForm({ initialData, onSubmit }: Props) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const handleFinish = async (values: MembershipFormValues) => {
    const result = schema.safeParse(values);
    if (!result.success) {
      // Map Zod errors to Form.Item
      const fieldErrors = result.error.issues.map((issue) => ({
        name: issue.path,
        errors: [issue.message],
      }));
      form.setFields(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(result.data);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} onFinish={handleFinish} layout="vertical">
      <Form.Item name="name" label="Name" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="email" label="Email">
        <Input />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={submitting} disabled={submitting}>
        {initialData ? 'Update' : 'Create'}
      </Button>
    </Form>
  );
}
```

---

## 12. File Organization

- **One component per file**.
- **Group by feature** under `components/<feature>/`.
- **Common / shared** components go under `components/common/`.

```
src/
├── components/
│   ├── common/
│   │   ├── AppButton.tsx
│   │   ├── AppCard.tsx
│   │   ├── ConfirmModal.tsx
│   │   └── EmptyState.tsx
│   ├── membership/
│   │   ├── MembershipCard.tsx
│   │   ├── MembershipList.tsx
│   │   ├── MembershipForm.tsx
│   │   └── useMemberships.ts
│   ├── booking/
│   │   ├── BookingCalendar.tsx
│   │   ├── BookingList.tsx
│   │   ├── BookingForm.tsx
│   │   └── useBookings.ts
│   └── dashboard/
│       ├── StatsCard.tsx
│       ├── RevenueChart.tsx
│       ├── RecentActivity.tsx
│       └── useDashboard.ts
└── pages/
    ├── MembershipsPage.tsx
    ├── BookingsPage.tsx
    └── DashboardPage.tsx
```

---

## 13. Directory Template (Feature Component)

Every feature follows this pattern:

```
components/membership/
├── MembershipCard.tsx       # Presentational card component
├── MembershipList.tsx       # List with loading/empty/error states
├── MembershipForm.tsx       # Form with validation (create/edit)
└── useMemberships.ts        # Custom hook: data fetching, mutations, caching
```

- **`*.tsx`** for components with JSX.
- **`*.ts`** for hooks, types, and pure utilities.
- Index files are allowed for barrel exports only when the feature has many public components (3+).
