# MCPKit Scripts

This directory contains automation scripts for the MCPKit project.

## release.sh

Automated release script for publishing MCPKit packages to npm.

### Usage

```bash
./scripts/release.sh <version> [options]
```

### Version Arguments

| Argument | Description | Example |
|----------|-------------|---------|
| `patch` | Bump patch version | 0.1.0 → 0.1.1 |
| `minor` | Bump minor version | 0.1.0 → 0.2.0 |
| `major` | Bump major version | 0.1.0 → 1.0.0 |
| `<version>` | Set specific version | 1.0.0-beta.1 |

### Options

| Option | Description |
|--------|-------------|
| `--package <name>` | Package to release: `core`, `cli`, `testing`, or `all` (default: `all`) |
| `--dry-run` | Run all checks without publishing or modifying files |
| `--skip-git` | Skip git commit and tag creation |
| `-h, --help` | Show help message |

### Examples

```bash
# Release all packages with a patch version bump
./scripts/release.sh patch

# Release only the core package with a minor bump
./scripts/release.sh minor --package core

# Test a release without making changes
./scripts/release.sh patch --dry-run

# Release with a specific version
./scripts/release.sh 1.0.0

# Release without git operations (useful for CI)
./scripts/release.sh patch --skip-git
```

### What It Does

The release script performs the following steps:

1. **Git Status Check** - Ensures working directory is clean (skippable with `--skip-git`)
2. **Lint** - Runs Biome to check code quality
3. **Build** - Builds all packages with Turbo
4. **Test** - Runs the full test suite
5. **Version Update** - Bumps versions in selected package.json files
6. **Git Commit & Tag** - Creates commit and tags for the release
7. **Publish** - Publishes packages to npm

### Tags Created

When releasing all packages, the script creates:
- Individual package tags: `@mcpkit-dev/core@x.x.x`, `@mcpkit-dev/cli@x.x.x`, `@mcpkit-dev/testing@x.x.x`
- Release tag: `vx.x.x`

When releasing a single package:
- Package tag: `@mcpkit-dev/<package>@x.x.x`

### NPM Scripts

You can also use these npm scripts from the project root:

```bash
# Full releases
npm run release:patch    # Patch release for all packages
npm run release:minor    # Minor release for all packages
npm run release:major    # Major release for all packages
npm run release:dry      # Dry run test

# Individual package releases
npm run release:core     # Patch release for core only
npm run release:cli      # Patch release for cli only
npm run release:testing  # Patch release for testing only

# Manual publishing (after version bump)
npm run publish:core
npm run publish:cli
npm run publish:testing
npm run publish:all
```

### Requirements

- Node.js 18+
- npm 10+
- Git
- Authenticated npm session (`npm login`)

### Troubleshooting

**"You have uncommitted changes"**
Commit or stash your changes before releasing, or use `--skip-git`.

**"npm ERR! 402 Payment Required"**
Ensure the package has `"access": "public"` or use `--access public` flag.

**"npm ERR! 403 Forbidden"**
Check that you're logged into npm and have publish permissions for the @mcpkit-dev org.

**Dry run modified files**
The dry-run mode should not modify any files. If it does, please report an issue.
