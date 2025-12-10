#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
VERSION_TYPE=""
DRY_RUN=false
SKIP_GIT=false
PACKAGE="all"

# Available packages
PACKAGES="core cli testing"

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
  echo "  --package <name>   Package to release (core, cli, testing, all)"
  echo "                     Default: all"
  echo "  --dry-run          Run all checks but don't publish"
  echo "  --skip-git         Skip git commit and tag"
  echo "  -h, --help         Show this help message"
  echo ""
  echo "Examples:"
  echo "  $0 patch                          # Release all packages with patch bump"
  echo "  $0 minor --package core           # Release only core with minor bump"
  echo "  $0 patch --dry-run                # Test patch release"
  echo "  $0 1.0.0                          # Release all with specific version"
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    patch|minor|major)
      VERSION_TYPE=$1
      shift
      ;;
    --package)
      PACKAGE=$2
      shift 2
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

# Validate package name
if [[ "$PACKAGE" != "all" && ! " $PACKAGES " =~ " $PACKAGE " ]]; then
  echo -e "${RED}Error: Invalid package '$PACKAGE'. Must be one of: $PACKAGES, all${NC}"
  exit 1
fi

# Navigate to project root
cd "$(dirname "$0")/.."
PROJECT_ROOT=$(pwd)

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MCPKit Release Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Package(s): ${PACKAGE}${NC}"
echo -e "${BLUE}Version: ${VERSION_TYPE}${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}Mode: DRY RUN${NC}"
fi
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

# Determine which packages to release
if [ "$PACKAGE" = "all" ]; then
  RELEASE_PACKAGES=$PACKAGES
else
  RELEASE_PACKAGES=$PACKAGE
fi

# Step 5: Update versions
echo ""
echo -e "${YELLOW}[5/7] Updating versions...${NC}"

# Store versions in files temporarily
VERSION_DIR=$(mktemp -d)
trap "rm -rf $VERSION_DIR" EXIT

for pkg in $RELEASE_PACKAGES; do
  echo -e "${BLUE}  Updating @mcpkit-dev/${pkg}...${NC}"
  cd "$PROJECT_ROOT/packages/$pkg"

  # Get current version
  CURRENT_VERSION=$(node -p "require('./package.json').version")
  echo "    Current version: $CURRENT_VERSION"

  if [ "$DRY_RUN" = true ]; then
    if [[ "$VERSION_TYPE" =~ ^[0-9] ]]; then
      NEW_VERSION=$VERSION_TYPE
    else
      # Calculate new version without modifying files
      case $VERSION_TYPE in
        patch)
          NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."$2"."$3+1}')
          ;;
        minor)
          NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."$2+1".0"}')
          ;;
        major)
          NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1+1".0.0"}')
          ;;
      esac
    fi
    echo -e "${YELLOW}    ⚠ Dry run - would update to: $NEW_VERSION${NC}"
  else
    if [[ "$VERSION_TYPE" =~ ^[0-9] ]]; then
      npm version $VERSION_TYPE --no-git-tag-version > /dev/null
      NEW_VERSION=$VERSION_TYPE
    else
      NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version | tr -d 'v')
    fi
    echo -e "${GREEN}    ✓ Updated to: $NEW_VERSION${NC}"
  fi

  # Store version in temp file
  echo "$NEW_VERSION" > "$VERSION_DIR/$pkg"
done

cd "$PROJECT_ROOT"

# Also update root package.json version
if [ "$PACKAGE" = "all" ] && [ "$DRY_RUN" = false ]; then
  echo -e "${BLUE}  Updating root package.json...${NC}"
  if [[ "$VERSION_TYPE" =~ ^[0-9] ]]; then
    npm version $VERSION_TYPE --no-git-tag-version > /dev/null
  else
    npm version $VERSION_TYPE --no-git-tag-version > /dev/null
  fi
  echo -e "${GREEN}    ✓ Root package updated${NC}"
fi

# Step 6: Git commit and tag
echo ""
echo -e "${YELLOW}[6/7] Creating git commit and tag...${NC}"

if [ "$SKIP_GIT" = false ] && [ "$DRY_RUN" = false ]; then
  # Add all updated package.json files
  for pkg in $RELEASE_PACKAGES; do
    git add "packages/$pkg/package.json"
  done

  if [ "$PACKAGE" = "all" ]; then
    git add package.json
    FIRST_VERSION=$(cat "$VERSION_DIR/core")

    # Build commit message
    COMMIT_MSG="chore(release): v$FIRST_VERSION

Released packages:"
    for pkg in $RELEASE_PACKAGES; do
      PKG_VERSION=$(cat "$VERSION_DIR/$pkg")
      COMMIT_MSG="$COMMIT_MSG
- @mcpkit-dev/${pkg}@${PKG_VERSION}"
    done

    git commit -m "$COMMIT_MSG"

    # Create tags for each package
    for pkg in $RELEASE_PACKAGES; do
      PKG_VERSION=$(cat "$VERSION_DIR/$pkg")
      git tag -a "@mcpkit-dev/${pkg}@${PKG_VERSION}" -m "Release @mcpkit-dev/${pkg}@${PKG_VERSION}"
      echo -e "${GREEN}  ✓ Created tag: @mcpkit-dev/${pkg}@${PKG_VERSION}${NC}"
    done

    # Also create a release tag
    git tag -a "v$FIRST_VERSION" -m "Release v$FIRST_VERSION"
    echo -e "${GREEN}  ✓ Created release tag: v$FIRST_VERSION${NC}"
  else
    PKG_VERSION=$(cat "$VERSION_DIR/$PACKAGE")
    git commit -m "chore(release): @mcpkit-dev/${PACKAGE}@${PKG_VERSION}"
    git tag -a "@mcpkit-dev/${PACKAGE}@${PKG_VERSION}" -m "Release @mcpkit-dev/${PACKAGE}@${PKG_VERSION}"
    echo -e "${GREEN}  ✓ Created tag: @mcpkit-dev/${PACKAGE}@${PKG_VERSION}${NC}"
  fi
elif [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}  ⚠ Dry run - would create tags for:${NC}"
  for pkg in $RELEASE_PACKAGES; do
    PKG_VERSION=$(cat "$VERSION_DIR/$pkg")
    echo -e "${YELLOW}    - @mcpkit-dev/${pkg}@${PKG_VERSION}${NC}"
  done
else
  echo -e "${YELLOW}  ⚠ Skipping git commit and tag${NC}"
fi

# Step 7: Publish to npm
echo ""
echo -e "${YELLOW}[7/7] Publishing to npm...${NC}"

for pkg in $RELEASE_PACKAGES; do
  PKG_VERSION=$(cat "$VERSION_DIR/$pkg")
  echo -e "${BLUE}  Publishing @mcpkit-dev/${pkg}...${NC}"

  if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}    ⚠ Dry run - would publish @mcpkit-dev/${pkg}@${PKG_VERSION}${NC}"
    npm publish -w "@mcpkit-dev/$pkg" --access public --dry-run 2>/dev/null || true
  else
    npm publish -w "@mcpkit-dev/$pkg" --access public
    echo -e "${GREEN}    ✓ Published @mcpkit-dev/${pkg}@${PKG_VERSION}${NC}"
  fi
done

# Done
echo ""
echo -e "${GREEN}========================================${NC}"
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}  Dry run completed successfully!${NC}"
  echo -e "${YELLOW}  Run without --dry-run to publish${NC}"
else
  echo -e "${GREEN}  Release completed successfully!${NC}"
  echo ""
  echo -e "${GREEN}  Published packages:${NC}"
  for pkg in $RELEASE_PACKAGES; do
    PKG_VERSION=$(cat "$VERSION_DIR/$pkg")
    echo -e "${GREEN}    - @mcpkit-dev/${pkg}@${PKG_VERSION}${NC}"
  done
  echo ""
  if [ "$SKIP_GIT" = false ]; then
    echo -e "${YELLOW}  Don't forget to push:${NC}"
    echo -e "  git push && git push --tags"
  fi
fi
echo -e "${GREEN}========================================${NC}"
