#!/bin/bash

# Start script for scanner service
# No longer installs Playwright browsers at runtime - this is handled during build

echo "Starting Scanner Microservice..."

# Start the Node.js application
exec node index.js