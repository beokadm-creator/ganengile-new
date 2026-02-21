#!/bin/bash

# EAS Build Script for Web
# Date: $(date +%Y-%m-%d)

set -e

echo "======================================"
echo "🚀 EAS Build for Web"
echo "======================================"
echo ""

# Check if user is logged in
echo "📋 Checking EAS login status..."
if ! eas whoami > /dev/null 2>&1; then
    echo "❌ Not logged in to EAS"
    echo "Please run: eas login"
    exit 1
fi

echo "✅ Logged in to EAS"
echo ""

# Start build
echo "🔨 Starting EAS Build for web platform..."
echo "This may take 10-15 minutes"
echo ""

eas build --platform web --profile production

echo ""
echo "======================================"
echo "✅ EAS Build Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Download the build artifacts"
echo "2. Extract to Firebase Hosting public directory"
echo "3. Run: firebase deploy --only hosting"
echo ""
