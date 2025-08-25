#!/bin/bash

# Check if Playwright browsers are installed
if [ ! -d "/opt/render/.cache/ms-playwright" ] || [ ! -d "$HOME/.cache/ms-playwright" ]; then
  echo "Installing Playwright browsers..."
  npx playwright install chromium
fi

# Start the application
echo "Starting scanner service..."
node index.js