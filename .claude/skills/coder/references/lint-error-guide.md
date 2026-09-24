# Lint Error Navigation Guide

Common lint/TypeScript errors and how to fix them.

## TypeScript Errors

| Error | Fix | Location |
|-------|-----|----------|
| `TS2322: Type X not assignable to Y` | Check type definitions, add proper casting or fix the source type | Entity/DTO files |
| `TS2339: Property does not exist` | Add property to interface/type, or use type guard | Interface/type files |
| `TS7006: Parameter implicitly has any` | Add explicit type annotation | Function parameters |
| `TS2345: Argument not assignable` | Check function signature, fix argument type | Call sites |
| `TS6133: Declared but never used` | Remove unused variable/import, or prefix with `_` | Affected file |
| `TS2304: Cannot find name` | Add import or install missing @types package | Import section |

## ESLint Errors

| Rule | Fix | Location |
|------|-----|----------|
| `@typescript-eslint/no-explicit-any` | Replace `any` with specific type or `unknown` | Type annotations |
| `@typescript-eslint/no-unused-vars` | Remove or prefix with `_` | Variable declarations |
| `no-console` | Use logger service instead of `console.log` | Service/controller files |
| `prefer-const` | Change `let` to `const` if never reassigned | Variable declarations |
| `@typescript-eslint/explicit-function-return-type` | Add return type annotation | Exported functions |
| `import/order` | Reorder imports: framework > internal > relative | Import section |
| `@typescript-eslint/no-floating-promises` | Add `await` or `.catch()` | Async call sites |

## NestJS-Specific

| Error | Fix | Location |
|-------|-----|----------|
| `Nest can't resolve dependencies` | Add missing provider to module `providers` array | `*.module.ts` |
| `Cannot determine a GraphQL input type` | Add `@InputType()` decorator | DTO files |
| `Circular dependency detected` | Use `forwardRef()` or restructure modules | Module imports |

## React/Frontend

| Error | Fix | Location |
|-------|-----|----------|
| `react-hooks/rules-of-hooks` | Move hook to top level of component | Component file |
| `react-hooks/exhaustive-deps` | Add missing dependencies to dep array, or restructure | `useEffect`/`useMemo` |
| `jsx-a11y/click-events-have-key-events` | Add `onKeyDown` handler alongside `onClick` | JSX elements |
| `jsx-a11y/no-static-element-interactions` | Add `role` and keyboard handler, or use `<button>` | JSX elements |

## Quick Fix Commands

```bash
# Auto-fix lint issues
npx nx lint <project> --fix

# Check TypeScript without building
npx tsc --noEmit

# Fix specific ESLint rule across project
npx eslint --fix --rule '@typescript-eslint/no-unused-vars: error' src/
```
