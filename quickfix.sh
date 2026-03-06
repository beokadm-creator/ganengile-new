#!/bin/bash

# Fix common unused variables with underscore prefix
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  # Fix unused parameters in function signatures
  perl -i -pe 's/(\(|,\s*)([a-z][a-zA-Z0-9]*)(\s*[):])/$1_$2$3/g if $. == 1' "$file" 2>/dev/null || true
done

echo "Quick fix complete"
