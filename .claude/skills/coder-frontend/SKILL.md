---
name: coder-frontend
description: Implement frontend features following component-based architecture and modern best practices. Use for React/Vue/Angular implementation, component development, state management, and frontend bug fixes. Triggers on "frontend code", "implement component", "React", "Vue", "Angular", "frontend bug".
phase: execution
flow-next: code-reviewer
flow-alternatives: [browser-verify, test-generator]
related: [coder, frontend-design, browser-verify]
---

# Coder Frontend

## Overview

Implement frontend features following component-based architecture, modern frameworks, and best practices.

## Project Structure Requirement

**CRITICAL:** All frontend code MUST be created inside the `frontend/` directory in the project root.

```
project-root/
├── backend/           ← Backend code (separate)
└── frontend/          ← ALL frontend code goes here
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── hooks/
    │   ├── api/
    │   ├── styles/
    │   └── utils/
    ├── public/
    ├── package.json
    └── tsconfig.json
```

**Why:** This prevents merge conflicts when backend and frontend branches are merged. Never create `src/`, `package.json`, or other frontend files directly in the project root.

**There is no root `package.json`.** Run `npm install` inside `backend/` or `frontend/` directly, not from the project root.

**Before starting:** Verify `frontend/` directory exists. If not, create it first.

## Generated File Naming Convention (MANDATORY)

**ANY documentation or markdown file created by this skill MUST be prefixed with `coder-frontend-`:**
- ✅ `coder-frontend-component-guide.md`, `coder-frontend-setup-notes.md`
- ❌ `COMPONENT_GUIDE.md`, `SETUP_NOTES.md`

This applies to ALL generated documentation files — summaries, guides, notes, reports.
Source code files (`.ts`, `.tsx`, `.css`, `.json`, etc.) follow standard project naming conventions and are exempt.

## Performance Guidelines

**For React/Next.js projects:** Apply the performance patterns from `.claude/skills/react-best-practices/AGENTS.md`. Key priorities:

1. **CRITICAL - Eliminate Waterfalls**: Use `Promise.all()` for parallel operations, defer `await` to branches where used, use Suspense boundaries
2. **CRITICAL - Bundle Size**: Import directly (avoid barrels), use dynamic imports for heavy components, defer third-party scripts
3. **HIGH - Server Performance**: Use `React.cache()` for deduplication, minimize client serialization, parallelize server fetches
4. **MEDIUM - Re-renders**: Memoize expensive components, use primitive dependencies, derive state instead of subscribing to raw values

Read the full guidelines in `.claude/skills/react-best-practices/AGENTS.md` when working on React/Next.js code.

## Implementation Workflow

```
1. UNDERSTAND → 2. PLAN → 3. IMPLEMENT → 4. TEST → 5. REVIEW
```

### Step 1: Understand

Review existing codebase for:
- Component patterns
- State management patterns
- Styling patterns
- Test patterns

### Step 2: Plan

- Identify components to create/modify
- Determine state management approach
- Plan API integrations
- Plan test coverage

### Step 3: Implement

Follow project conventions and existing patterns.

### Step 4: Test (Verify-Fix Loop)

- Write unit tests for components
- Write integration tests for features
- Run `npx nx test <frontend-project>`
- **If tests fail:** Read FULL error output -> Fix root cause -> Re-run tests
- **Max 3 attempts.** If still failing after 3 fixes, escalate to `/debugger`
- MUST NOT proceed to completion with failing tests

### Step 5: Pre-Completion Verification

Run applicable checks from [DOD.md](../../DOD.md) (Standard tier):
- Run tests (if test tooling exists)
- Run lint (if lint tooling exists)
- Run build (if build tooling exists)
- Check accessibility compliance
- Verify responsive behavior
- Verify file naming follows skill-prefix convention
- If any check fails, fix or escalate — do not skip
- Include verification evidence in Context Summary

## Component Architecture

Plan component hierarchy before implementation:

```
App
├── Layout
│   ├── Header
│   ├── Sidebar
│   └── Footer
├── Pages
│   ├── HomePage
│   ├── DashboardPage
│   └── SettingsPage
└── Features
    ├── Auth
    │   ├── LoginForm
    │   └── RegisterForm
    ├── Users
    │   ├── UserList
    │   └── UserProfile
    └── Shared
        ├── Button
        ├── Input
        └── Modal
```

## State Management Decision

| State Type       | Solution            | When to Use                 |
| ---------------- | ------------------- | --------------------------- |
| Local UI state   | useState/useReducer | Form inputs, toggles        |
| Shared UI state  | Context             | Theme, user preferences     |
| Server state     | React Query/SWR     | API data                    |
| Global app state | Zustand/Redux       | Complex cross-cutting state |

## Theme Tokens Pattern

Define consistent design tokens:

```typescript
const theme = {
  colors: {
    primary: '#3B82F6',
    secondary: '#6366F1',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    text: { primary: '#1F2937', secondary: '#6B7280' },
    background: { primary: '#FFFFFF', secondary: '#F3F4F6' },
  },
  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
  borderRadius: { sm: '0.25rem', md: '0.375rem', lg: '0.5rem', full: '9999px' },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: { xs: '0.75rem', sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.25rem' },
  },
};
```

## Responsive Breakpoints

```css
/* Mobile-first breakpoints */
/* xs: 0px    - Mobile */
/* sm: 640px  - Small tablets */
/* md: 768px  - Tablets */
/* lg: 1024px - Small laptops */
/* xl: 1280px - Desktops */
/* 2xl: 1536px - Large screens */
```

## Component Structure

### React Component Template

```typescript
// user-card.tsx
import React from 'react';
import styles from './user-card.module.css';

interface UserCardProps {
  user: User;
  onSelect?: (user: User) => void;
  className?: string;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onSelect,
  className,
}) => {
  const handleClick = () => {
    onSelect?.(user);
  };

  return (
    <div
      className={`${styles.card} ${className || ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      <img
        src={user.avatar}
        alt={`${user.name}'s avatar`}
        className={styles.avatar}
      />
      <div className={styles.content}>
        <h3 className={styles.name}>{user.name}</h3>
        <p className={styles.email}>{user.email}</p>
      </div>
    </div>
  );
};

UserCard.displayName = 'UserCard';
```

### Custom Hook Template

```typescript
// use-users.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '@/api/user-api';

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: userApi.getAll,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => userApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

## State Management

### Local State

```typescript
const [value, setValue] = useState<string>('');
const [items, setItems] = useState<Item[]>([]);
```

### Context

```typescript
// theme-context.tsx
interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be within ThemeProvider');
  return context;
}
```

### Server State (React Query)

```typescript
// Queries for reads
const { data, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});

// Mutations for writes
const mutation = useMutation({
  mutationFn: createUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});
```

## Testing

### Component Test

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from './user-card';

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    avatar: '/avatar.jpg',
  };

  it('renders user information', () => {
    render(<UserCard user={mockUser} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<UserCard user={mockUser} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(mockUser);
  });
});
```

### Hook Test

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUsers } from './use-users';

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useUsers', () => {
  it('fetches users', async () => {
    const { result } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
  });
});
```

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Component | `kebab-case.tsx` | `user-card.tsx` |
| Hook | `use-kebab-case.ts` | `use-users.ts` |
| Utility | `kebab-case.ts` | `format-date.ts` |
| Test | `*.spec.tsx` or `*.test.tsx` | `user-card.spec.tsx` |
| Styles | `*.module.css` | `user-card.module.css` |
| Types | `*.types.ts` | `user.types.ts` |

## Component Patterns

### Container/Presentational

```typescript
// Container (smart component) - handles data fetching
export const UserListContainer: React.FC = () => {
  const { data: users, isLoading } = useUsers();
  if (isLoading) return <LoadingSpinner />;
  return <UserList users={users} />;
};

// Presentational (dumb component) - pure UI
interface UserListProps { users: User[]; }
export const UserList: React.FC<UserListProps> = ({ users }) => (
  <ul>
    {users.map((user) => <UserListItem key={user.id} user={user} />)}
  </ul>
);
```

### Compound Components

```typescript
// Flexible composition pattern
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

### Custom Hook Pattern

```typescript
export function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}
```

## Accessibility Checklist

- [ ] Semantic HTML elements
- [ ] ARIA labels where needed
- [ ] Keyboard navigation
- [ ] Focus management
- [ ] Color contrast (WCAG AA minimum)
- [ ] Screen reader testing
- [ ] Reduced motion support (`prefers-reduced-motion`)

## Quality Checklist

Before completing, verify against [DOD.md](../../DOD.md):

- [ ] Components are properly typed
- [ ] Props have appropriate defaults
- [ ] Accessibility attributes present
- [ ] Error states handled
- [ ] Loading states handled
- [ ] Tests written
- [ ] Lint passes
- [ ] File naming uses `coder-frontend-` prefix for any generated docs

---

## Next Steps

After frontend implementation is complete, STOP and present these options:

**Next by flow:** [[/code-reviewer]] `[context]` - Review the frontend code for quality and issues. See [[moc-execution]] for phase context.

**Alternatives:**
- [[/browser-verify]] `[context]` - Visually verify UI changes in the running app before code review.
- [[/test-generator]] `[context]` - Generate component and hook tests.
- [[/debugger]] `[context]` - Debug any issues with the implementation.
