# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Lifecycle Hooks** - Server lifecycle and monitoring hooks for logging and observability
  - `onServerStart` / `onServerStop` - Server lifecycle events
  - `onToolCall` / `onToolSuccess` / `onToolError` - Tool execution events
  - `onResourceRead` / `onResourceSuccess` / `onResourceError` - Resource read events
  - `onPromptGet` / `onPromptSuccess` / `onPromptError` - Prompt retrieval events
  - `awaitHooks` option to control hook execution (await vs fire-and-forget)
- **`@Monitor` decorator** - Per-method monitoring and logging configuration
  - `logArgs` - Log input arguments
  - `logResult` - Log return values
  - `logDuration` - Log execution duration
  - `logErrors` - Log errors
  - Custom `logger` and `errorLogger` functions
- Hook context types exported: `ToolCallContext`, `ToolSuccessContext`, `ToolErrorContext`, `ResourceReadContext`, `ResourceSuccessContext`, `ResourceErrorContext`, `PromptGetContext`, `PromptSuccessContext`, `PromptErrorContext`
- `ServerHooks` and `MonitorOptions` types exported from main package
- CLI templates now include hooks configuration by default

## [1.3.0] - 2025-12-10

### Added

- Tool annotations support (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`)
- Enhanced type exports for better DX

### Changed

- Updated MCP SDK peer dependency to ^1.12.0

## [1.2.0] - 2025-12-10

### Added

- Streamable HTTP transport support
- Session management for HTTP transports
- `onSessionInitialized` and `onSessionClosed` callbacks for transport lifecycle

### Changed

- Improved transport abstraction layer

## [1.1.0] - 2025-12-09

### Added

- SSE (Server-Sent Events) transport support
- HTTP transport configuration options
- `@mcpkit-dev/testing` package with mock client utilities
- `@mcpkit-dev/cli` package for project scaffolding

### Changed

- Monorepo structure with Turborepo
- Improved build configuration with tsup

## [1.0.0] - 2025-12-09

### Added

- **Core decorators**
  - `@MCPServer` - Class decorator to define MCP servers
  - `@Tool` - Method decorator to expose tools
  - `@Resource` - Method decorator to expose resources
  - `@Prompt` - Method decorator to create prompt templates
  - `@Param` - Parameter decorator for tool/prompt arguments
- **Zod integration** - Runtime validation with automatic JSON Schema generation
- **TypeScript support** - Full type inference from decorators
- **Multiple transport support** - stdio, SSE, and Streamable HTTP
- **Metadata storage** - Reflect-metadata based decorator metadata system
- **Schema builder** - Automatic Zod schema generation from `@Param` decorators
- **Error handling** - Custom error types (`MCPKitError`, `BootstrapError`, `DecoratorError`, etc.)
- **Result formatting** - Automatic tool result formatting for MCP protocol

### Technical

- Built on `@modelcontextprotocol/sdk`
- Requires `reflect-metadata` for decorator support
- Node.js 18+ required
- TypeScript 5.0+ with `experimentalDecorators` and `emitDecoratorMetadata`

## [0.1.x] - 2025-12-09

### Added

- Initial beta releases
- Core decorator implementation
- Basic stdio transport

---

[Unreleased]: https://github.com/v-checha/mcpkit/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/v-checha/mcpkit/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/v-checha/mcpkit/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/v-checha/mcpkit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/v-checha/mcpkit/compare/v0.1.0...v1.0.0
[0.1.x]: https://github.com/v-checha/mcpkit/releases/tag/v0.1.0
