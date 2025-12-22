---
sidebar_position: 3
---

# TypeScript Configuration

MCPKit uses TypeScript decorators extensively. This requires specific TypeScript settings to work correctly.

## Required Configuration

Create or update your `tsconfig.json`:

```json
{
  "compilerOptions": {
    // Required for decorators
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,

    // Recommended settings
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    // Strict mode (recommended)
    "strict": true,
    "strictPropertyInitialization": false,

    // Output
    "outDir": "dist",
    "declaration": true,

    // Other useful settings
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## Understanding the Settings

### `experimentalDecorators`

Enables the experimental decorator syntax used by `@MCPServer`, `@Tool`, `@Resource`, etc.

### `emitDecoratorMetadata`

Emits design-type metadata for decorated declarations. This allows MCPKit to infer parameter types automatically.

### `target: "ES2022"`

ES2022 includes all the features MCPKit needs, including:
- Top-level await
- Class fields
- Private class members

### `module: "NodeNext"`

Uses Node.js's native ESM resolution, which is the modern standard for Node.js packages.

## Common Issues

### "Decorators are not enabled"

Make sure `experimentalDecorators` is set to `true` in your `tsconfig.json`.

### "Unable to infer types"

Ensure `emitDecoratorMetadata` is `true`. Without this, MCPKit can't automatically infer parameter types.

### Import Errors

If you see ESM/CJS import errors, ensure:
1. `module` is set to `"NodeNext"`
2. Your `package.json` has `"type": "module"`
3. Imports include the `.js` extension (even for `.ts` files)

## Example Project Structure

```
my-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   └── server.ts
└── dist/
    ├── index.js
    └── server.js
```

## package.json

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts"
  },
  "dependencies": {
    "@mcpkit-dev/core": "^2.0.0",
    "reflect-metadata": "^0.2.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

:::tip Required Import

Always import `reflect-metadata` at the top of your entry file before any other imports:

```typescript
import 'reflect-metadata';
import { createServer, MCPServer, Tool, Param } from '@mcpkit-dev/core';
```

This is required for TypeScript decorators to work properly.

:::
