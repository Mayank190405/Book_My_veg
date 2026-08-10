#!/bin/bash
# Direct EC2 Fast Rebuild & Reload Script
# Run directly on EC2 instance when pulling git updates: ./ec2_direct_deploy.sh

set -e

echo "⚡ [1/3] Pulling latest git repository updates..."
git pull origin main

echo "⚡ [2/3] Fast building Server & Client..."
(cd server && npm ci --prefer-offline --no-audit && npm run build)
(cd client && npm ci --prefer-offline --no-audit && npm run build)

echo "⚡ [3/3] Hot-restarting PM2 services without downtime..."
pm2 restart all || pm2 start ecosystem.config.js

echo "✅ Direct EC2 Hot-Reload Deployment Finished in seconds!"
