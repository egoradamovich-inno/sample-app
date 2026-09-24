---
title: Use Proper Table Markup
impact: HIGH
impactDescription: enables data table navigation with assistive tech
tags: semantic, tables, data
related: [semantic-list-structure, aria-labels-required]
---

## Use Proper Table Markup

**Impact: HIGH (enables data table navigation with assistive tech)**

Use `<table>`, `<thead>`, `<tbody>`, `<th>` with `scope` for data tables. Screen readers use headers to announce cell context. WCAG 1.3.1.

**Incorrect: div grid as table**

```tsx
function UserTable({ users }) {
  return (
    <div className="grid">
      <div className="row header">
        <div>Name</div><div>Email</div><div>Role</div>
      </div>
      {users.map(u => (
        <div className="row" key={u.id}>
          <div>{u.name}</div><div>{u.email}</div><div>{u.role}</div>
        </div>
      ))}
    </div>
  )
}
```

**Correct: semantic table**

```tsx
function UserTable({ users }) {
  return (
    <table>
      <caption>Team members</caption>
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Email</th>
          <th scope="col">Role</th>
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id}>
            <td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

Use `role="presentation"` or `role="none"` on `<table>` only for layout tables (not data).

Tables need accessible names via `<caption>` or `aria-labelledby` — see [[aria-labels-required]]. For non-tabular grouped data, use [[semantic-list-structure]] instead.
