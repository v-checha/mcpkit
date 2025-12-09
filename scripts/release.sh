#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
VERSION_TYPE=""
DRY_RUN=false
SKIP_GIT=false

# Usage function
usage() {
  echo "Usage: $0 <patch|minor|major|version> [options]"
  echo ""
  echo "Arguments:"
  echo "  patch          Bump patch version (0.1.0 -> 0.1.1)"
  echo "  minor          Bump minor version (0.1.0 -> 0.2.0)"
  echo "  major          Bump major version (0.1.0 -> 1.0.0)"
  echo "  <version>      Set specific version (e.g., 1.2.3, 1.0.0-beta.1)"
  echo ""
  echo "Options:"
  echo "  --dry-run      Run all checks but don't publish"
  echo "  --skip-git     Skip git commit and tag"
  echo "  -h, --help     Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 patch                    # Release patch version"
  echo "  $0 minor --dry-run          # Test minor release"
  echo "  $0 1.0.0-beta.1             # Release specific version"
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    patch|minor|major)
      VERSION_TYPE=$1
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-git)
      SKIP_GIT=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      # Assume it's a version number
      if [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        VERSION_TYPE=$1
      else
        echo -e "${RED}Error: Unknown argument '$1'${NC}"
        usage
      fi
      shift
      ;;
  esac
done

# Check if version type is provided
if [ -z "$VERSION_TYPE" ]; then
  echo -e "${RED}Error: Version type is required${NC}"
  usage
fi

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MCPKit Release Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Check for uncommitted changes
echo -e "${YELLOW}[1/7] Checking git status...${NC}"
if [ "$SKIP_GIT" = false ]; then
  if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}Error: You have uncommitted changes. Please commit or stash them first.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ Git working directory is clean${NC}"
else
  echo -e "${YELLOW}⚠ Skipping git checks${NC}"
fi

# Step 2: Run linting
echo ""
echo -e "${YELLOW}[2/7] Running linter...${NC}"
npm run check
echo -e "${GREEN}✓ Linting passed${NC}"

# Step 3: Build packages
echo ""
echo -e "${YELLOW}[3/7] Building packages...${NC}"
npm run build
echo -e "${GREEN}✓ Build successful${NC}"

# Step 4: Run tests
echo ""
echo -e "${YELLOW}[4/7] Running tests...${NC}"
npm run test
echo -e "${GREEN}✓ All tests passed${NC}"

# Step 5: Update version
echo ""
echo -e "${YELLOW}[5/7] Updating version...${NC}"
cd packages/core

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

if [ "$DRY_RUN" = true ]; then
  if [[ "$VERSION_TYPE" =~ ^[0-9] ]]; then
    NEW_VERSION=$VERSION_TYPE
  else
    NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version --dry-run 2>/dev/null | tail -1 | tr -d 'v')
  fi
  echo -e "${YELLOW}⚠ Dry run - would update to: $NEW_VERSION${NC}"
else
  if [[ "$VERSION_TYPE" =~ ^[0-9] ]]; then
    npm version $VERSION_TYPE --no-git-tag-version
    NEW_VERSION=$VERSION_TYPE
  else
    NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version | tr -d 'v')
  fi
  echo -e "${GREEN}✓ Updated to version: $NEW_VERSION${NC}"
fi

cd "$PROJECT_ROOT"

# Step 6: Git commit and tag
echo ""
echo -e "${YELLOW}[6/7] Creating git commit and tag...${NC}"
if [ "$SKIP_GIT" = false ] && [ "$DRY_RUN" = false ]; then
  git add packages/core/package.json
  git commit -m "chore(release): @mcpkit/core@$NEW_VERSION"
  git tag -a "@mcpkit/core@$NEW_VERSION" -m "Release @mcpkit/core@$NEW_VERSION"
  echo -e "${GREEN}✓ Created commit and tag: @mcpkit/core@$NEW_VERSION${NC}"
elif [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}⚠ Dry run - would create tag: @mcpkit/core@$NEW_VERSION${NC}"
else
  echo -e "${YELLOW}⚠ Skipping git commit and tag${NC}"
fi

# Step 7: Publish to npm
echo ""
echo -e "${YELLOW}[7/7] Publishing to npm...${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}⚠ Dry run - would publish @mcpkit/core@$NEW_VERSION${NC}"
  npm publish -w @mcpkit/core --access public --dry-run
else
  npm publish -w @mcpkit/core --access public
  echo -e "${GREEN}✓ Published @mcpkit/core@$NEW_VERSION to npm${NC}"
fi

# Done
echo ""
echo -e "${GREEN}========================================${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}  Dry run completed successfully!${NC}"
  echo -e "${YELLOW}  Run without --dry-run to publish${NC}"
else
  echo -e "${GREEN}  Release completed successfully!${NC}"
  echo ""
  echo -e "${GREEN}  Published: @mcpkit/core@$NEW_VERSION${NC}"
  echo ""
  if [ "$SKIP_GIT" = false ]; then
    echo -e "${YELLOW}  Don't forget to push:${NC}"
    echo -e "  git push && git push --tags"
  fi
fi
echo -e "${GREEN}========================================${NC}"
