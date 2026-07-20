# Database Conventions — GymPro

> MongoDB / Mongoose conventions for the GymPro Gym Management System.

---

## 1. Mongoose Schema Conventions

Every schema follows this canonical structure:

```typescript
import { Schema, model, Document } from 'mongoose';

// -- Interface (optional but recommended) --
export interface IUser extends Document {
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// -- Schema --
const schema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.MEMBER },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,      // adds createdAt, updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// -- Model --
export const User = model<IUser>('User', schema);
```

---

## 2. Required Conventions

| Rule | Value |
|---|---|
| `timestamps` | `true` on **every** schema |
| `toJSON.virtuals` | `true` — exposes computed fields in JSON responses |
| `toObject.virtuals` | `true` — exposes computed fields when using `.toObject()` |
| `_id` | Always included (never disable) |
| `versionKey` | `false` preferred — removes the `__v` property |
| Collection names | Plural snake_case (Mongoose auto-generates from model name: `User` → `users`) |
| Schema file location | `/src/models/` |
| Schema file naming | PascalCase.ts (e.g. `User.ts`, `MembershipCycle.ts`) |

### Schema template

```typescript
const schema = new Schema<IModel>(
  { /* fields */ },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
```

---

## 3. Field Type Mapping

| TypeScript / JS | Mongoose Schema Definition |
|---|---|
| `string` | `{ type: String }` |
| `number` | `{ type: Number }` |
| `boolean` | `{ type: Boolean, default: false }` |
| `Date` | `{ type: Date }` |
| `ObjectId` (ref) | `{ type: Schema.Types.ObjectId, ref: 'Collection' }` |
| `string[]` | `[{ type: String }]` |
| `ObjectId[]` | `[{ type: Schema.Types.ObjectId, ref: 'Collection' }]` |
| `Record<string, any>` | `{ type: Schema.Types.Mixed }` — **avoid unless strictly necessary** |
| `Map<string, T>` | `{ type: Map, of: T }` |

### Money

All monetary values are stored as **integers** (cents / smallest unit). Never use floating-point numbers.

```typescript
price: { type: Number, required: true, min: 0 },     // stored in cents
```

When presenting to the client, divide by 100 (handled in a virtual, service layer, or frontend formatter).

---

## 4. Validation Conventions

| Constraint | When to use |
|---|---|
| `required: true` | Every essential / non-nullable field |
| `enum` | Status fields, roles, fixed-category values |
| `min` / `max` | Numeric bounds (age, price, duration) |
| `minlength` / `maxlength` | String length limits |
| `match` | Patterns — email, phone, postal code |
| `validate` | Custom synchronous or async validators |
| `unique` | Logical uniqueness constraints (creates a unique index) |

### Async validators for uniqueness

```typescript
email: {
  type: String,
  required: true,
  unique: true,
  lowercase: true,
  trim: true,
  validate: {
    validator: async function (value: string): Promise<boolean> {
      const existing = await mongoose.model('User').findOne({
        email: value,
        _id: { $ne: this._id },
      });
      return !existing;
    },
    message: 'Email already in use',
  },
},
```

Always use async validators (or a pre-save hook) for uniqueness checks — the `unique` index alone does not provide application-level error messages.

---

## 5. Query Conventions

| Scenario | Method |
|---|---|
| Read-only queries | `.lean()` — returns plain JS objects, much faster |
| Populate refs | `.populate('field', 'selectedField1 selectedField2')` |
| Limit projection | `.select('field1 field2')` — never select `*` |
| Pagination | `.skip(n).limit(m)` or use `mongoose-paginate-v2` |
| Sorting | `.sort({ createdAt: -1 })` — most recent first |
| Soft-delete | `.where({ deletedAt: null })` on every query |


### Example

```typescript
const members = await User
  .find({ role: UserRole.MEMBER })
  .where({ deletedAt: null })
  .select('name email createdAt')
  .populate('memberships', 'plan startDate endDate')
  .sort({ createdAt: -1 })
  .lean();
```

### Pagination with plugin

```typescript
const result = await User.paginate(
  { deletedAt: null },
  {
    page: 1,
    limit: 20,
    sort: { createdAt: -1 },
    select: 'name email role createdAt',
    populate: [{ path: 'memberships', select: 'plan startDate endDate' }],
    lean: true,
  }
);
```

---

## 6. Index Conventions

- All indexes **defined in the schema definition**, never created ad-hoc.
- Compound index field order: **equality → sort → range**.

```typescript
schema.index({ status: 1, createdAt: -1 }, { name: 'idx_status_createdAt' });
schema.index({ email: 1 }, { name: 'idx_email', unique: true });
```

| Rule | Detail |
|---|---|
| Naming | `idx_{field1}_{field2}...` — explicit, readable |
| Background | `{ background: true }` for large collections |
| Unique | Always name explicitly: `{ name: 'idx_email', unique: true }` |
| Multi-key | Avoid indexes on array fields without careful analysis of cardinality |
| Sparse | `{ sparse: true }` for fields that may be `null` except on a subset of documents |

---

## 7. Hooks (Middleware)

| Hook | Use Case |
|---|---|
| `pre('save')` | Password hashing, slug generation, default value computation |
| `pre('findOneAndUpdate')` | Manual `updatedAt` handling (though `timestamps: true` usually covers this) |
| `pre('find')` / `pre('findOne')` | Automatically inject `{ deletedAt: null }` for soft-delete |
| `post('save')` | Audit logging, notification triggers, cache invalidation |
| `post('find')` | Transforming result shape, attaching computed values |

```typescript
schema.pre<IUser>('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
```

**Rule**: Hooks must be lightweight. Heavy work (email dispatching, PDF generation, third-party API calls) belongs in **service layer** functions, never inside hooks.

---

## 8. Virtual Fields

Use virtuals for computed properties that should appear in JSON / Object output but not be persisted.

```typescript
schema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

schema.virtual('isExpiring').get(function (this: IMembership) {
  return this.endDate && dayjs(this.endDate).diff(dayjs(), 'days') <= 7;
});

schema.virtual('membershipStatus').get(function (this: IMembership) {
  const now = new Date();
  if (this.deletedAt) return 'cancelled';
  if (this.startDate > now) return 'pending';
  if (this.endDate < now) return 'expired';
  return 'active';
});
```

| Rule | Detail |
|---|---|
| Enable | `toJSON: { virtuals: true }` and `toObject: { virtuals: true }` |
| Naming | camelCase, descriptive |
| Overwrite | Never create a virtual that shadows an existing real field |

---

## 9. Plugins

| Plugin | Purpose |
|---|---|
| `mongoose-paginate-v2` | `.paginate(query, options)` — skip/limit wrapper with metadata |
| `mongoose-aggregate-paginate-v2` | `.aggregatePaginate()` for aggregation pipeline pagination |
| Custom soft-delete plugin | Adds `isDeleted` + `deletedAt` fields and filters queries |

### Soft-delete plugin (custom)

```typescript
function softDeletePlugin(schema: Schema): void {
  schema.add({ isDeleted: { type: Boolean, default: false } });
  schema.add({ deletedAt: { type: Date, default: null } });

  schema.pre(/^find/, function (this: any, next) {
    if (!this.getQuery().includeDeleted) {
      this.where({ deletedAt: null });
    }
    next();
  });

  schema.methods.softDelete = async function (): Promise<void> {
    this.isDeleted = true;
    this.deletedAt = new Date();
    await this.save();
  };

  schema.statics.softDeleteById = async function (id: string): Promise<void> {
    await this.findByIdAndUpdate(id, { isDeleted: true, deletedAt: new Date() });
  };
}
```

---

## 10. Transactions

Use MongoDB transactions (sessions) for multi-document operations that must be atomic.

```typescript
import mongoose from 'mongoose';

async function processMembershipPayment(
  userId: string,
  membershipId: string,
  amount: number
): Promise<void> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const wallet = await Wallet.findOneAndUpdate(
      { user: userId, deletedAt: null },
      { $inc: { balance: -amount } },
      { session, new: true }
    );

    if (!wallet || wallet.balance < 0) {
      throw new AppError('Insufficient funds', 400);
    }

    await Membership.findByIdAndUpdate(
      membershipId,
      { status: 'active', activatedAt: new Date() },
      { session }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

| Setting | Value |
|---|---|
| Transaction timeout | 5 seconds |
| Retry policy | Retry on `TransientTransactionError` (MongoDB error code – 24) |

```typescript
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.code !== 24 || attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## 11. Connection Management

```typescript
import mongoose from 'mongoose';

interface MongoConfig {
  primaryUri: string;
  fallbackUri: string;
}

async function connectDatabase(config: MongoConfig): Promise<void> {
  const options: mongoose.ConnectOptions = {
    maxPoolSize: 20,
    minPoolSize: 5,
    keepAlive: true,
    keepAliveInitialDelay: 120000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(config.primaryUri, options);
    console.log('Connected to MongoDB Atlas (primary)');
  } catch (primaryError) {
    console.warn('Primary connection failed, attempting fallback:', primaryError);
    try {
      await mongoose.connect(config.fallbackUri, { ...options, readPreference: 'secondaryPreferred' });
      console.log('Connected to local MongoDB (fallback, read-only)');
    } catch (fallbackError) {
      console.error('All database connections failed:', fallbackError);
      process.exit(1);
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
}
```

| Parameter | Value | Reason |
|---|---|---|
| Connection pool (min) | 5 | Keep baseline connections ready |
| Connection pool (max) | 20 | Tuned for concurrent API requests ~100 RPS |
| Keepalive | 120 000 ms | Prevent AWS/Atlas load balancer from dropping idle connections |
| Server selection timeout | 5 000 ms | Fast failover when primary is unreachable |
| Socket timeout | 45 000 ms | Accommodate aggregation queries on large collections |

### Environment variables

```
MONGODB_URI_ATLAS=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/gympro?retryWrites=true&w=majority
MONGODB_URI_LOCAL=mongodb://localhost:27017/gympro
```

---

## 12. Naming

| Artifact | Convention | Examples |
|---|---|---|
| Model | PascalCase, singular | `User`, `MembershipCycle`, `CheckIn` |
| Schema variable | camelCase | `userSchema`, `membershipCycleSchema` |
| Schema file | PascalCase.ts | `User.ts`, `MembershipCycle.ts` |
| Interface | PascalCase, optional `I` prefix | `IUser`, `IMembershipCycle` |
| Collection | plural snake_case | `users`, `membership_cycles` (auto-generated by Mongoose) |
| Index name | `idx_{field1}_{field2}` | `idx_status_createdAt`, `idx_email` |
| Virtual | camelCase | `fullName`, `isExpiring`, `membershipStatus` |
| Plugin file | kebab-case | `soft-delete.plugin.ts`, `paginate.plugin.ts` |

> Mongoose automatically pluralizes and converts model names to snake_case for the underlying MongoDB collection.  
> `'User'` → `'users'`, `'MembershipCycle'` → `'membershipcycles'` (default behaviour).  
> To override: `model('User', schema, 'members')` — only when the auto name is undesirable.

---

*Last updated: 2026-07-20*
