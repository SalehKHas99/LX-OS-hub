#!/bin/bash
# LX-OS Hub — Neon Branch Management Utilities
# Usage: ./branch.sh [create|delete|list] [branch-name]

set -e

PROJECT_ID="${NEON_PROJECT_ID:?Set NEON_PROJECT_ID}"
API_KEY="${NEON_API_KEY:?Set NEON_API_KEY}"
BASE="https://console.neon.tech/api/v2"

auth() { echo "-H \"Authorization: Bearer $API_KEY\""; }

case "${1:-list}" in
  list)
    echo "=== Neon branches for project $PROJECT_ID ==="
    curl -s -H "Authorization: Bearer $API_KEY" \
      "$BASE/projects/$PROJECT_ID/branches" | python3 -m json.tool
    ;;

  create)
    NAME="${2:?Usage: ./branch.sh create <branch-name>}"
    echo "Creating branch: $NAME"
    curl -s -X POST -H "Authorization: Bearer $API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"branch\":{\"name\":\"$NAME\"},\"endpoints\":[{\"type\":\"read_write\"}]}" \
      "$BASE/projects/$PROJECT_ID/branches" | python3 -m json.tool
    ;;

  delete)
    NAME="${2:?Usage: ./branch.sh delete <branch-name>}"
    # Get branch ID by name
    BRANCH_ID=$(curl -s -H "Authorization: Bearer $API_KEY" \
      "$BASE/projects/$PROJECT_ID/branches" \
      | python3 -c "import json,sys; data=json.load(sys.stdin); [print(b['id']) for b in data['branches'] if b['name']=='$NAME']")
    if [ -z "$BRANCH_ID" ]; then echo "Branch '$NAME' not found"; exit 1; fi
    echo "Deleting branch: $NAME ($BRANCH_ID)"
    curl -s -X DELETE -H "Authorization: Bearer $API_KEY" \
      "$BASE/projects/$PROJECT_ID/branches/$BRANCH_ID" | python3 -m json.tool
    ;;

  *)
    echo "Usage: ./branch.sh [list|create <name>|delete <name>]"
    exit 1
    ;;
esac
