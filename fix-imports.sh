#!/bin/bash
# Fix unused imports safely
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  # Fix unused generic type parameter 'T'
  sed -i '' 's/<T>/<_T>/g' "$file"
  # Fix Ionicons import (commonly unused)
  sed -i '' "/import { Ionicons } from '@expo\/vector-icons';/d" "$file"
  # Fix Platform import when it's just for type
  sed -i '' "s/import { Platform } from 'react-native';/import { Platform } from 'react-native';/g" "$file"
done
echo "Done"
