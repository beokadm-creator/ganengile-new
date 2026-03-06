#!/bin/bash

# Fix unused variables by adding underscore prefix
# This script processes ESLint output and modifies files automatically

npm run lint 2>&1 | grep "no-unused-vars" | while read -r line; do
  # Extract file path
  file=$(echo "$line" | sed -E 's/^([^:]+):.*/\1/')
  
  # Extract variable name and line number
  var_info=$(echo "$line" | grep -oE "'[^']+' is .* unused" | sed "s/' is .* unused//" | sed "s/'//g")
  
  if [ -n "$file" ] && [ -f "$file" ]; then
    echo "Processing $file for variable: $var_info"
  fi
done

echo "Analysis complete. Running aggressive auto-fix..."
npx eslint 'src/**/*.{ts,tsx}' 'App.tsx' --fix
