#!/bin/bash
#
# Pre-commit hook to ensure database migrations are generated and committed
# when schema files are modified.
#
# This script checks:
# 1. If any schema files are staged for commit
# 2. If so, whether corresponding migration files are also staged
# 3. That migration files have meaningful names (not just numbers)
#

set -e

SCHEMA_PATH="packages/lib/src/db/schema"
DRIZZLE_PATH="apps/saas/drizzle"

# Get staged schema files (excluding deletions)
STAGED_SCHEMA_FILES=$(git diff --cached --name-only --diff-filter=ACMR -- "$SCHEMA_PATH/*.ts" 2>/dev/null || true)

# Exit early if no schema files are staged
if [ -z "$STAGED_SCHEMA_FILES" ]; then
  exit 0
fi

echo "Detected staged schema changes:"
echo "$STAGED_SCHEMA_FILES" | sed 's/^/  - /'
echo ""

# Check for staged migration files
STAGED_MIGRATIONS=$(git diff --cached --name-only --diff-filter=A -- "$DRIZZLE_PATH/*.sql" 2>/dev/null || true)
STAGED_META_FILES=$(git diff --cached --name-only --diff-filter=ACMR -- "$DRIZZLE_PATH/meta/*.json" 2>/dev/null || true)

if [ -z "$STAGED_MIGRATIONS" ]; then
  echo "ERROR: Schema files were modified but no new migration files are staged."
  echo ""
  echo "Please generate a migration with a descriptive name:"
  echo ""
  echo "  pnpm db:generate --name <descriptive-name>"
  echo ""
  echo "Example names:"
  echo "  pnpm db:generate --name add-user-preferences"
  echo "  pnpm db:generate --name remove-legacy-comments"
  echo "  pnpm db:generate --name update-video-schema"
  echo ""
  echo "Then stage and commit the generated migration files:"
  echo "  git add $DRIZZLE_PATH/"
  echo ""
  exit 1
fi

# Check that migration files have meaningful names (not just numbers like 0011_.sql)
for migration in $STAGED_MIGRATIONS; do
  filename=$(basename "$migration")
  # Extract the part after the number prefix (e.g., "add-feature" from "0011_add-feature.sql")
  name_part=$(echo "$filename" | sed -E 's/^[0-9]+_(.*)\.sql$/\1/')

  # Check if the name part is empty or too short (less than 3 chars)
  if [ -z "$name_part" ] || [ ${#name_part} -lt 3 ]; then
    echo "ERROR: Migration file '$filename' does not have a meaningful name."
    echo ""
    echo "Migration names should be descriptive. Please regenerate with:"
    echo ""
    echo "  pnpm db:generate --name <descriptive-name>"
    echo ""
    echo "The name should describe what the migration does, e.g.:"
    echo "  - add-user-preferences"
    echo "  - remove-legacy-comments"
    echo "  - update-video-schema"
    echo ""
    exit 1
  fi
done

# Check that meta files are also staged
if [ -z "$STAGED_META_FILES" ]; then
  echo "WARNING: Migration SQL files are staged but meta files are missing."
  echo ""
  echo "Please also stage the meta files:"
  echo "  git add $DRIZZLE_PATH/meta/"
  echo ""
  exit 1
fi

echo "Migration check passed:"
echo "$STAGED_MIGRATIONS" | sed 's/^/  - /'
echo ""
