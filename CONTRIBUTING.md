# Contributing to MCPKit

Thank you for your interest in contributing to MCPKit! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Release Process](#release-process)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone. Please be kind, considerate, and constructive in all interactions.

## Getting Started

### Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 10.9.0
- **Git**: Latest stable version

### Development Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/mcpkit.git
   cd mcpkit
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/anthropics/mcpkit.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Build all packages**:
   ```bash
   npm run build
   ```

6. **Run tests** to verify setup:
   ```bash
   npm run test
   ```

## Project Structure

MCPKit is a Turborepo monorepo with the following structure:

```
mcpkit/
├── packages/
│   ├── core/           # Core decorators and server framework (@mcpkit-dev/core)
│   ├── cli/            # CLI tool for project scaffolding (@mcpkit-dev/cli)
│   └── testing/        # Testing utilities and mock clients (@mcpkit-dev/testing)
├── examples/
│   └── weather-server/ # Working example project
├── scripts/
│   └── release.sh      # Automated release script
├── biome.json          # Code formatting and linting config
├── tsconfig.base.json  # Shared TypeScript configuration
└── turbo.json          # Turborepo pipeline configuration
```

### Package Dependencies

- **@mcpkit-dev/core**: The main package containing decorators, transports, and server logic
- **@mcpkit-dev/cli**: Depends on core for scaffolding templates
- **@mcpkit-dev/testing**: Testing utilities that work with core

## Development Workflow

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all packages |
| `npm run dev` | Watch mode for development |
| `npm run test` | Run all tests |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | Run Biome linter |
| `npm run lint:fix` | Fix linting issues |
| `npm run format` | Format code with Biome |
| `npm run check` | Run full Biome check (lint + format) |
| `npm run check:fix` | Fix all Biome issues |
| `npm run clean` | Remove build artifacts |

### Development Flow

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in the appropriate package(s)

3. **Run checks locally**:
   ```bash
   npm run check      # Lint and format check
   npm run typecheck  # Type checking
   npm run test       # Run tests
   ```

4. **Build to verify**:
   ```bash
   npm run build
   ```

## Code Standards

### TypeScript Configuration

The project uses strict TypeScript with the following key settings:

- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- Experimental decorators enabled
- No unused locals/parameters
- No unchecked indexed access

### Biome (Linting & Formatting)

We use [Biome](https://biomejs.dev/) for linting and formatting. Key style rules:

- **Indentation**: 2 spaces
- **Line width**: 100 characters
- **Quotes**: Single quotes
- **Semicolons**: Always
- **Trailing commas**: All (in JS/TS)
- **Arrow function parentheses**: Always

Run `npm run check:fix` to automatically fix most issues.

### Code Style Guidelines

- Write TypeScript with proper types - avoid `any` when possible
- Use `const` by default, `let` only when reassignment is needed
- Prefer `import type` for type-only imports
- Include JSDoc comments for public APIs
- Keep functions small and focused
- Use descriptive variable and function names
- Handle errors appropriately with custom error types

### Example Code Style

```typescript
import type { ToolConfig } from './types';

import { Tool } from '../decorators';
import { MCPKitError } from '../errors';

/**
 * Executes a tool with the given configuration.
 * @param config - The tool configuration
 * @returns The execution result
 * @throws {MCPKitError} When execution fails
 */
@Tool({ name: 'example' })
export const executeTool = async (config: ToolConfig): Promise<Result> => {
  if (!config.name) {
    throw new MCPKitError('Tool name is required');
  }

  return performExecution(config);
};
```

## Testing

### Test Framework

We use [Vitest](https://vitest.dev/) for testing with the following configuration:

- Test files: `**/*.test.ts` (colocated with source files)
- Environment: Node.js
- Coverage provider: V8

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (in a specific package)
cd packages/core
npm run test:watch

# Run tests with coverage
npm run test -- --coverage
```

### Writing Tests

- Place test files alongside source files with `.test.ts` extension
- Write descriptive test names that explain the expected behavior
- Test both success and error cases
- Use the testing utilities from `@mcpkit-dev/testing` for MCP-specific tests

```typescript
import { describe, it, expect } from 'vitest';
import { MyClass } from './my-class';

describe('MyClass', () => {
  describe('myMethod', () => {
    it('should return expected value when given valid input', () => {
      const instance = new MyClass();
      const result = instance.myMethod('valid');
      expect(result).toBe('expected');
    });

    it('should throw error when given invalid input', () => {
      const instance = new MyClass();
      expect(() => instance.myMethod('')).toThrow('Invalid input');
    });
  });
});
```

## Commit Guidelines

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

### Scopes

- `core`: Changes to @mcpkit-dev/core
- `cli`: Changes to @mcpkit-dev/cli
- `testing`: Changes to @mcpkit-dev/testing
- `deps`: Dependency updates
- `release`: Release-related changes

### Examples

```
feat(core): add support for streaming responses
fix(cli): resolve template generation on Windows
docs: update installation instructions
test(core): add unit tests for Tool decorator
chore(deps): update typescript to 5.7.2
```

## Pull Request Process

### Before Submitting

1. **Sync with upstream**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run the full check suite**:
   ```bash
   npm run prepublish:check
   ```

3. **Update documentation** if needed

4. **Add tests** for new functionality

### PR Guidelines

- Use a clear, descriptive title following commit conventions
- Fill out the PR template completely
- Link related issues using keywords (`Fixes #123`, `Closes #456`)
- Keep PRs focused - one feature or fix per PR
- Respond to review feedback promptly

### Review Process

1. Automated checks must pass (lint, tests, build)
2. At least one maintainer approval required
3. All review comments must be addressed
4. Branch must be up to date with main

## Release Process

Releases are managed by maintainers using the release script. The process:

1. Ensure clean working directory
2. Run all checks and tests
3. Bump version (patch/minor/major)
4. Create git commit and tag
5. Publish to npm

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **PATCH**: Bug fixes, backwards compatible
- **MINOR**: New features, backwards compatible
- **MAJOR**: Breaking changes

### Changelog

All notable changes are documented in [CHANGELOG.md](./CHANGELOG.md) following the [Keep a Changelog](https://keepachangelog.com/) format.

## Questions?

If you have questions about contributing:

1. Check existing [issues](https://github.com/anthropics/mcpkit/issues) and [discussions](https://github.com/anthropics/mcpkit/discussions)
2. Open a new issue or discussion if needed
3. Reach out to maintainers

Thank you for contributing to MCPKit!
