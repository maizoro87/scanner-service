#!/bin/bash

# Build script for Render deployment
echo "Installing dependencies..."
npm install

echo "Installing Playwright browsers..."
# Install only Chromium to save space and time
npx playwright install chromium

echo "Build completed successfully!"