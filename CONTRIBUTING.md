# Contributing to valai

Thank you for your interest in contributing to valai! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Please:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept responsibility for mistakes and learn from them

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/valai.git
   cd valai
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/v-checha/valai.git
   ```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build the package |
| `npm run dev` | Build in watch mode |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run bench` | Run benchmarks |
| `npm run bench:run` | Run benchmarks once |
| `npm run typecheck` | Type check without emitting |
| `npm run lint` | Lint the codebase |
| `npm run clean` | Clean build artifacts |

## Project Structure

```
valai/
├── packages/
│   └── core/                 # Main package
│       ├── src/
│       │   ├── schemas/      # Schema types (string, number, object, etc.)
│       │   ├── parse/        # Parsing context and results
│       │   ├── repair/       # JSON repair utilities
│       │   ├── types/        # TypeScript type definitions
│       │   ├── factory.ts    # Schema factory (v.string(), v.object(), etc.)
│       │   └── index.ts      # Public exports
│       ├── __tests__/        # Test files
│       ├── __benchmarks__/   # Benchmark files
│       └── package.json
├── scripts/                  # Build and publish scripts
├── vitest.config.ts          # Test configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Root package.json
```

## Making Changes

### Branch Naming

Use descriptive branch names:

- `feature/add-date-schema` - New features
- `fix/repair-nested-quotes` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/simplify-parser` - Code refactoring
- `perf/optimize-repair` - Performance improvements

### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `perf` - Performance improvements
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(schema): add date validation support

fix(repair): handle nested single quotes correctly

docs(readme): add examples for parseLLM usage

test(object): add tests for strict mode
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Avoid `any` type - use `unknown` if type is truly unknown
- Export types alongside implementations
- Use JSDoc comments for public APIs

```typescript
/**
 * Validates that a string is a valid email address.
 *
 * @example
 * ```typescript
 * const schema = v.string().email();
 * schema.parse('user@example.com'); // OK
 * schema.parse('invalid'); // Throws
 * ```
 */
email(message?: string): ValaiString {
  // implementation
}
```

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- No semicolons (handled by prettier)
- Prefer `const` over `let`
- Use arrow functions for callbacks
- Destructure when appropriate

### File Organization

- One schema type per file in `schemas/`
- Keep files focused and under 500 lines
- Export public API from `index.ts`
- Co-locate tests with source when possible

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npx vitest run src/__tests__/object.test.ts

# Run tests with coverage
npx vitest run --coverage
```

### Writing Tests

- Place tests in `src/__tests__/` directory
- Name test files `*.test.ts`
- Use descriptive test names
- Test both success and failure cases
- Test edge cases

```typescript
import { describe, it, expect } from 'vitest';
import { v } from '../factory.js';

describe('v.string()', () => {
  it('should parse valid strings', () => {
    const schema = v.string();
    expect(schema.parse('hello')).toBe('hello');
  });

  it('should reject non-strings', () => {
    const schema = v.string();
    expect(() => schema.parse(123)).toThrow();
  });

  describe('.email()', () => {
    it('should validate email format', () => {
      const schema = v.string().email();
      expect(schema.parse('user@example.com')).toBe('user@example.com');
    });

    it('should reject invalid emails', () => {
      const schema = v.string().email();
      expect(() => schema.parse('invalid')).toThrow();
    });
  });
});
```

### Benchmarks

For performance-sensitive changes, add or update benchmarks:

```typescript
import { bench, describe } from 'vitest';
import { v } from '../factory.js';

describe('String Parsing', () => {
  const schema = v.string().email();

  bench('email validation', () => {
    schema.parse('user@example.com');
  });
});
```

Run benchmarks:
```bash
npm run bench:run
```

## Submitting Changes

### Pull Request Process

1. **Update your fork**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Make your changes** and commit them

4. **Run checks**:
   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature
   ```

6. **Create a Pull Request** on GitHub

### PR Guidelines

- Fill out the PR template completely
- Link related issues
- Include tests for new features
- Update documentation if needed
- Keep PRs focused - one feature/fix per PR
- Ensure all CI checks pass

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested the changes

## Checklist
- [ ] Tests pass locally
- [ ] Code follows project style
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

## Reporting Issues

### Bug Reports

When reporting bugs, include:

1. **Description** - Clear description of the bug
2. **Reproduction** - Steps to reproduce
3. **Expected behavior** - What should happen
4. **Actual behavior** - What actually happens
5. **Environment** - Node version, OS, valai version
6. **Code sample** - Minimal reproduction code

```markdown
**Bug Description**
parseLLM fails to extract JSON from markdown with language tag

**Reproduction**
const schema = v.object({ name: v.string() });
schema.parseLLM('```json\n{"name": "test"}\n```');

**Expected**
{ name: 'test' }

**Actual**
Error: Expected object, received string

**Environment**
- Node: 20.10.0
- OS: macOS 14.0
- valai: 0.1.2
```

### Feature Requests

For feature requests, include:

1. **Problem** - What problem does this solve?
2. **Proposal** - How should it work?
3. **Alternatives** - Other solutions considered
4. **Examples** - Code examples of desired API

## Questions?

- Open a [GitHub Discussion](https://github.com/v-checha/valai/discussions)
- Check existing [Issues](https://github.com/v-checha/valai/issues)

Thank you for contributing to valai!
